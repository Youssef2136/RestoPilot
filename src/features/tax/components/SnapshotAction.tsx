import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../../../lib/supabase'
import { taxClient, type BranchTaxConfig } from '../taxClient'
import { useRecordTaxSnapshot, useTaxInvalidation } from '../useTax'
import styles from './tax.surfaces.module.css'

/**
 * The owner's tax-snapshot action (spec 028 FR-08/D1): records the branch's
 * CURRENTLY SAVED configuration — the engine-facing rules as saved, not a
 * preview — as a once-only snapshot, keyed by the composed fingerprint. The
 * RPC is owner-only and once-only per fingerprint: a conflicting re-record
 * reports `recorded:false`, which the surface STATES as the once-only
 * guarantee holding (never an error); refusals render verbatim.
 *
 * The fingerprint composes the run label with the configuration's content —
 * a changed configuration is a different fingerprint, so the once-only rule
 * binds per configuration, not per label.
 */

interface BranchOption {
  id: string
  name: string
}

/** The branch list behind the picker (the context switcher's read pattern). */
function useOwnerBranches(restaurantId: string | null) {
  return useQuery({
    queryKey: ['tax', 'snapshot-branches', restaurantId] as const,
    queryFn: async (): Promise<BranchOption[]> => {
      if (restaurantId === null) return []
      const { data, error } = await getSupabaseClient()
        .from('branches')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true })
      if (error !== null) {
        throw new Error(error.message)
      }
      return (data ?? []) as BranchOption[]
    },
    enabled: restaurantId !== null,
  })
}

export function SnapshotAction({ restaurantId }: { restaurantId: string }) {
  const branchesQuery = useOwnerBranches(restaurantId)
  const branches = useMemo(() => branchesQuery.data ?? [], [branchesQuery.data])
  const [branchId, setBranchId] = useState<string | null>(null)
  const effectiveBranchId =
    branchId !== null && branches.some((branch) => branch.id === branchId)
      ? branchId
      : (branches[0]?.id ?? null)
  const [label, setLabel] = useState('')

  const record = useRecordTaxSnapshot()
  const invalidate = useTaxInvalidation()

  type Feedback =
    | { tone: 'recorded'; branch: string }
    | { tone: 'already-recorded'; branch: string }
    | { tone: 'error'; message: string }
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleRecord() {
    if (effectiveBranchId === null || label.trim() === '' || record.isPending) {
      return
    }
    const branch = branches.find((candidate) => candidate.id === effectiveBranchId)
    setFeedback(null)
    // The payload binds the configuration content INTO the fingerprint: the
    // current saved rules (fetched read-only) — a later re-record of a
    // CHANGED configuration is a different snapshot by design.
    const configResult = await taxClient.getBranchTaxConfig(effectiveBranchId)
    if (!configResult.ok) {
      setFeedback({ tone: 'error', message: configResult.message })
      return
    }
    const config: BranchTaxConfig = configResult.data
    const fingerprint = [
      label.trim(),
      effectiveBranchId,
      config.rules.map((rule) => `${rule.rule_id}:${rule.rate}:${rule.origin}`).join('|'),
    ].join('::')
    try {
      const outcome = await record.mutateAsync({
        restaurantId,
        branchId: effectiveBranchId,
        fingerprint,
        payload: {
          label: label.trim(),
          branch_id: effectiveBranchId,
          rules: config.rules.map((rule) => ({
            name: rule.name,
            rate: rule.rate,
            scope: rule.scope,
            origin: rule.origin,
          })),
        },
      })
      if (outcome.recorded) {
        setFeedback({ tone: 'recorded', branch: branch?.name ?? 'the branch' })
        invalidate(restaurantId)
      } else {
        setFeedback({ tone: 'already-recorded', branch: branch?.name ?? 'the branch' })
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Recording failed.',
      })
    }
  }

  // The button label stays STABLE ('Record snapshot'; busy = 'Recording…')
  // — outcomes render in the status paragraph, never as button text, so the
  // user can always attempt another recording (and see the once-only outcome
  // stated when it repeats).
  const recordButtonLabel = record.isPending ? 'Recording…' : 'Record snapshot'

  return (
    <div className={styles.snapshotSection}>
      <p>
        Records a branch's tax configuration as currently saved — not a preview. One snapshot per
        configuration: recording the same configuration again reports it is already recorded, rather
        than creating a copy.
      </p>

      <div>
        <label htmlFor="tax-snapshot-branch">Branch</label>{' '}
        <select
          id="tax-snapshot-branch"
          value={effectiveBranchId ?? ''}
          disabled={record.isPending || branches.length === 0}
          onChange={(event) => {
            setBranchId(event.target.value)
            setFeedback(null)
          }}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tax-snapshot-label">Snapshot label</label>{' '}
        <input
          id="tax-snapshot-label"
          value={label}
          disabled={record.isPending}
          onChange={(event) => {
            setLabel(event.target.value)
            setFeedback(null)
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleRecord()}
        disabled={record.isPending || effectiveBranchId === null || label.trim() === ''}
      >
        {recordButtonLabel}
      </button>

      {feedback?.tone === 'error' && <p role="alert">{feedback.message}</p>}

      {(feedback?.tone === 'recorded' || feedback?.tone === 'already-recorded') && (
        <p role="status">
          {feedback.tone === 'recorded'
            ? `Snapshot recorded for ${feedback.branch}. The configuration was captured as it stands now — this exact configuration cannot be recorded twice.`
            : `No new snapshot was created for ${feedback.branch}: this configuration is already recorded.`}
        </p>
      )}
    </div>
  )
}
