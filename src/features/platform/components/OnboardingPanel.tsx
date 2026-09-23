/*
 * The console's onboarding form (spec 019 T009; FR-001–FR-007, FR-009; US1,
 * US3). One form: tenant fields + first-owner email/display name. The
 * server's messages pass through verbatim (the one rulebook); form state is
 * preserved on refusal so the super admin can correct it; a successful
 * onboarding that issued a credential shows it ONCE (the staff panel's
 * discipline — display, copy affordance, outcome note, cleared on the next
 * action), never logged or persisted.
 */

import { useState, type FormEvent } from 'react'
import { useOnboardRestaurant } from '../usePlatform'
import type { OnboardResult } from '../platformClient'

interface IssuedCredential {
  password: string
  outcome: string
}

interface Feedback {
  tone: 'error' | 'success'
  message: string
}

export function OnboardingPanel() {
  const onboard = useOnboardRestaurant()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [brandDescription, setBrandDescription] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [issued, setIssued] = useState<IssuedCredential | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    setCopyState('idle')
    const result: OnboardResult = await onboard.mutateAsync({
      name,
      slug,
      ownerEmail,
      ownerDisplayName,
      brandDescription: brandDescription === '' ? null : brandDescription,
      contactEmail: contactEmail === '' ? null : contactEmail,
      contactPhone: contactPhone === '' ? null : contactPhone,
      timezone: null,
    })
    setSubmitting(false)
    if (!result.ok) {
      // Server messages verbatim (or the denial notice); the form keeps its
      // values so the super admin can correct them.
      setFeedback({ tone: 'error', message: result.message })
      setIssued(null)
      return
    }

    const { data } = result
    setIssued(
      data.owner.temporaryPassword === null
        ? null
        : {
            password: data.owner.temporaryPassword,
            outcome:
              'The first owner can sign in with this temporary credential. It is shown only once — share it now; it can be rotated later through password recovery.',
          },
    )
    setFeedback({
      tone: 'success',
      message:
        data.owner.temporaryPassword === null
          ? `Onboarded "${data.name}" — the first owner is linked with no credential issued.`
          : `Onboarded "${data.name}" — a one-time credential was issued to the first owner.`,
    })
    // The new tenant appears in the overview below (the hook invalidated it).
    setName('')
    setSlug('')
    setOwnerEmail('')
    setOwnerDisplayName('')
    setBrandDescription('')
    setContactEmail('')
    setContactPhone('')
  }

  async function copyCredential() {
    if (issued === null) {
      return
    }
    // Runtime-guarded (the staff panel's convenience rule): the value stays
    // visible on screen; copying is never the credential's only path.
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
    <section aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">Onboard a restaurant</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="onboard-name">Restaurant name</label>
          <input
            id="onboard-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-slug">Public identifier</label>
          <input
            id="onboard-slug"
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-owner-email">First owner email</label>
          <input
            id="onboard-owner-email"
            type="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-owner-name">First owner display name</label>
          <input
            id="onboard-owner-name"
            type="text"
            value={ownerDisplayName}
            onChange={(event) => setOwnerDisplayName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-brand">Brand description (optional)</label>
          <input
            id="onboard-brand"
            type="text"
            value={brandDescription}
            onChange={(event) => setBrandDescription(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-contact-email">Contact email (optional)</label>
          <input
            id="onboard-contact-email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboard-contact-phone">Contact phone (optional)</label>
          <input
            id="onboard-contact-phone"
            type="text"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Onboarding…' : 'Onboard restaurant'}
        </button>
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </form>

      {issued !== null && (
        <div aria-labelledby="onboard-credential-heading">
          <h3 id="onboard-credential-heading">One-time temporary credential</h3>
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
        </div>
      )}
    </section>
  )
}
