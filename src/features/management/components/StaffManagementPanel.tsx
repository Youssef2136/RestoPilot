import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { AUTH_CONTEXT_QUERY_KEY } from '../../auth/useAuthContext'
import type { StaffRole } from '../managementClient'
import { managementClient } from '../managementClient'

/**
 * Owner-only staff management controls (contracts/management-client.md
 * §1/§4.3; FR-013/FR-014/FR-015): add a person by email and display name with
 * exactly one role (and, for the three branch-scoped roles, exactly one branch
 * of the restaurant); change an existing membership's role/branch; remove a
 * membership; and display the one-time temporary credential.
 *
 * The outcome message keys off the RETURN SHAPE, never off "the person already
 * existed" (contract §4.3):
 *   temporary_password === null                ⇒ existing person linked, no
 *                                                credential was issued
 *   non-null + person_created === false        ⇒ the existing person's account
 *                                                was completed and a new
 *                                                temporary credential was issued
 *   non-null + person_created === true         ⇒ a new person was created
 * The credential is shown once, with a copy affordance and the plain-language
 * note; it is never logged or persisted, and it can be rotated through the
 * platform's password-recovery flow.
 *
 * Owner-only by the page's in-page gate — presentation; the staff RPCs remain
 * the authorization boundary (Constitution IV). The server's messages are
 * surfaced verbatim (`P0001`) or as the module's denial notice (`42501`), and
 * form state is preserved so the owner can correct it.
 */

/** One member row as the panel manages it (the page's policy-scoped read). */
export interface StaffManagementMember {
  membershipId: string
  profileId: string
  displayName: string | null
  role: StaffRole
  branchId: string | null
}

export interface StaffManagementPanelProps {
  restaurantId: string
  /** The policy-scoped staff list read by the page. */
  members: readonly StaffManagementMember[]
  /** The policy-scoped branch options of this restaurant (names only). */
  branches: readonly { id: string; name: string }[]
}

/** The role choices with their user-facing labels (FR-013's four roles). */
const ROLE_OPTIONS: ReadonlyArray<{ value: StaffRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'branch_manager', label: 'Branch manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'kitchen', label: 'Kitchen' },
]

/** The three branch-scoped roles: a branch is required for exactly these. */
function isBranchScoped(role: StaffRole): boolean {
  return role !== 'owner'
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/** The one-time credential as displayed: the secret and its outcome note. */
interface IssuedCredential {
  password: string
  outcome: string
}

function memberLabel(member: StaffManagementMember): string {
  return member.displayName ?? 'this member'
}

function branchName(
  branches: readonly { id: string; name: string }[],
  branchId: string | null,
): string {
  if (branchId === null) {
    return 'All branches'
  }
  return branches.find((branch) => branch.id === branchId)?.name ?? 'Another branch'
}

export function StaffManagementPanel({
  restaurantId,
  members,
  branches,
}: StaffManagementPanelProps) {
  const queryClient = useQueryClient()

  // ── add member ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<StaffRole>('cashier')
  const [branchId, setBranchId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addFeedback, setAddFeedback] = useState<Feedback | null>(null)
  const [issued, setIssued] = useState<IssuedCredential | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle')

  // ── edit membership ────────────────────────────────────────────────────────
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<StaffRole>('cashier')
  const [editBranchId, setEditBranchId] = useState('')
  const [editFeedback, setEditFeedback] = useState<Feedback | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // ── remove membership ──────────────────────────────────────────────────────
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null)
  const [removeFeedback, setRemoveFeedback] = useState<Feedback | null>(null)
  const [removing, setRemoving] = useState(false)

  /**
   * A staff mutation changes the caller-visible staff list AND (for the acting
   * owner's own rows) the effective context — both cached reads are refreshed
   * from the authoritative server state (contract §1).
   */
  function invalidateStaffSurfaces() {
    void queryClient.invalidateQueries({ queryKey: ['staff-list', restaurantId] })
    void queryClient.invalidateQueries({ queryKey: AUTH_CONTEXT_QUERY_KEY })
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setAdding(true)
    setAddFeedback(null)
    setCopyState('idle')
    const result = await managementClient.addStaffMember({
      restaurantId,
      email,
      displayName,
      role,
      branchId: isBranchScoped(role) ? branchId : undefined,
    })
    setAdding(false)
    if (!result.ok) {
      // The server's message (validation or denial), verbatim; the form keeps
      // its values so the owner can correct them.
      setAddFeedback({ tone: 'error', message: result.message })
      setIssued(null)
      return
    }

    const added = result.data
    setEmail('')
    setDisplayName('')
    setIssued(
      added.temporary_password === null
        ? null
        : {
            password: added.temporary_password,
            outcome:
              added.person_created === false
                ? "That person's account was completed and a new temporary credential was issued."
                : 'The new person can sign in with this temporary credential.',
          },
    )
    setAddFeedback({
      tone: 'success',
      message:
        added.temporary_password === null
          ? 'Existing person linked — no credential was issued; their current sign-in is untouched.'
          : `Added ${added.membership.role === 'owner' ? 'as owner' : 'to the team'}.`,
    })
    invalidateStaffSurfaces()
  }

  function startEdit(member: StaffManagementMember) {
    setEditingMembershipId(member.membershipId)
    setEditRole(member.role)
    setEditBranchId(member.branchId ?? '')
    setEditFeedback(null)
    setPendingRemovalId(null)
  }

  function cancelEdit() {
    setEditingMembershipId(null)
    setEditFeedback(null)
  }

  async function saveEdit(event: FormEvent, member: StaffManagementMember) {
    event.preventDefault()
    setSavingEdit(true)
    setEditFeedback(null)
    const result = await managementClient.updateStaffMembership({
      membershipId: member.membershipId,
      role: editRole,
      branchId: isBranchScoped(editRole) ? editBranchId : undefined,
    })
    setSavingEdit(false)
    if (!result.ok) {
      setEditFeedback({ tone: 'error', message: result.message })
      return
    }
    setEditingMembershipId(null)
    setEditFeedback({
      tone: 'success',
      message: `${memberLabel(member)} now holds a different membership; effective access follows it on their next request.`,
    })
    invalidateStaffSurfaces()
  }

  async function confirmRemoval(member: StaffManagementMember) {
    setRemoving(true)
    setRemoveFeedback(null)
    const result = await managementClient.removeStaffMembership({
      membershipId: member.membershipId,
    })
    setRemoving(false)
    setPendingRemovalId(null)
    if (!result.ok) {
      // Includes the FR-016 last-owner rejection, verbatim.
      setRemoveFeedback({ tone: 'error', message: result.message })
      return
    }
    setRemoveFeedback({
      tone: 'success',
      message: `Removed ${memberLabel(member)}'s access to this restaurant. Their profile and sign-in remain, so they can be re-added.`,
    })
    invalidateStaffSurfaces()
  }

  async function copyCredential() {
    if (issued === null) {
      return
    }
    // Runtime-guarded: some environments (and the test runner) expose no
    // clipboard API, and copying is a convenience, never the credential's
    // only path — the value stays visible on screen.
    const clipboard: Clipboard | undefined = navigator.clipboard
    if (clipboard === undefined) {
      setCopyState('unavailable')
      return
    }
    try {
      await clipboard.writeText(issued.password)
      setCopyState('copied')
    } catch {
      setCopyState('unavailable')
    }
  }

  return (
    <section aria-labelledby="staff-management-heading">
      <h2 id="staff-management-heading">Manage staff</h2>

      <form onSubmit={handleAdd}>
        <h3>Add a person</h3>
        <div>
          <label htmlFor="staff-add-email">Email</label>
          <input
            id="staff-add-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="staff-add-name">Display name</label>
          <input
            id="staff-add-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="staff-add-role">Role</label>
          <select
            id="staff-add-role"
            value={role}
            onChange={(event) => {
              const next = event.target.value as StaffRole
              setRole(next)
              if (!isBranchScoped(next)) {
                setBranchId('')
              }
            }}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {isBranchScoped(role) && (
          <div>
            <label htmlFor="staff-add-branch">Branch</label>
            <select
              id="staff-add-branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" disabled={adding}>
          {adding ? 'Adding…' : 'Add staff member'}
        </button>
        {addFeedback !== null && (
          <p role={addFeedback.tone === 'error' ? 'alert' : 'status'}>{addFeedback.message}</p>
        )}
      </form>

      {issued !== null && (
        <div aria-labelledby="staff-credential-heading">
          <h3 id="staff-credential-heading">One-time temporary credential</h3>
          <p>{issued.outcome}</p>
          <p>
            <code>{issued.password}</code>
          </p>
          <button type="button" onClick={copyCredential}>
            Copy credential
          </button>
          {copyState === 'copied' && <p role="status">Copied.</p>}
          {copyState === 'unavailable' && (
            <p role="status">Copying is unavailable here — select and copy it manually.</p>
          )}
          <p>
            Share it with the person now: it is not shown again, and it can be rotated at any time
            through the platform&apos;s password-recovery flow.
          </p>
        </div>
      )}

      <h3>Existing members</h3>
      {members.length === 0 ? (
        <p>No staff members found for this restaurant.</p>
      ) : (
        <ul>
          {members.map((member) => (
            <li key={member.membershipId}>
              <p>
                {memberLabel(member)} — {ROLE_OPTIONS.find((o) => o.value === member.role)?.label} —{' '}
                {branchName(branches, member.branchId)}
              </p>
              {editingMembershipId === member.membershipId ? (
                <form onSubmit={(event) => void saveEdit(event, member)}>
                  <div>
                    <label htmlFor={`staff-edit-role-${member.membershipId}`}>
                      {`New role for ${memberLabel(member)}`}
                    </label>
                    <select
                      id={`staff-edit-role-${member.membershipId}`}
                      value={editRole}
                      onChange={(event) => {
                        const next = event.target.value as StaffRole
                        setEditRole(next)
                        if (!isBranchScoped(next)) {
                          setEditBranchId('')
                        }
                      }}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isBranchScoped(editRole) && (
                    <div>
                      <label htmlFor={`staff-edit-branch-${member.membershipId}`}>
                        {`New branch for ${memberLabel(member)}`}
                      </label>
                      <select
                        id={`staff-edit-branch-${member.membershipId}`}
                        value={editBranchId}
                        onChange={(event) => setEditBranchId(event.target.value)}
                      >
                        <option value="">Select a branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" disabled={savingEdit}>
                    {savingEdit ? 'Saving…' : `Save changes for ${memberLabel(member)}`}
                  </button>
                  <button type="button" onClick={cancelEdit}>
                    {`Cancel changes for ${memberLabel(member)}`}
                  </button>
                  {editFeedback !== null && (
                    <p role={editFeedback.tone === 'error' ? 'alert' : 'status'}>
                      {editFeedback.message}
                    </p>
                  )}
                </form>
              ) : pendingRemovalId === member.membershipId ? (
                <div>
                  <p>
                    Remove {memberLabel(member)}&apos;s access to this restaurant? Their profile and
                    sign-in identity remain.
                  </p>
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => void confirmRemoval(member)}
                  >
                    {removing ? 'Removing…' : `Confirm removal for ${memberLabel(member)}`}
                  </button>
                  <button type="button" onClick={() => setPendingRemovalId(null)}>
                    {`Cancel removal for ${memberLabel(member)}`}
                  </button>
                </div>
              ) : (
                <div>
                  <button type="button" onClick={() => startEdit(member)}>
                    {`Change role or branch for ${memberLabel(member)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingRemovalId(member.membershipId)
                      setEditingMembershipId(null)
                      setRemoveFeedback(null)
                    }}
                  >
                    {`Remove ${memberLabel(member)}`}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {removeFeedback !== null && (
        <p role={removeFeedback.tone === 'error' ? 'alert' : 'status'}>{removeFeedback.message}</p>
      )}
    </section>
  )
}
