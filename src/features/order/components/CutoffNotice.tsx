import styles from './order.surfaces.module.css'

/**
 * CutoffNotice (spec 025 T008; FR-08; specs/031 FR-02, D1): the cutoff
 * presented AS A STATE, not a submit-time surprise. The server still refuses
 * authoritatively (the preserved-cart-above-cutoff E2E pin exercises that
 * verbatim path — the submit button stays enabled); this notice explains why
 * continuation is closed while the customer is still browsing. Channels
 * only: dine-in has no cutoff.
 *
 * The cutoff fires when the session's order is already on its way (delivery)
 * or handed over / ready (takeaway) — the same rule the refusal enforces —
 * so the notice rides the session-context echo rather than guessing from the
 * history, and the CROSSED sentence is appended only when the derivation
 * (`cutoffCrossed`, D1) says so.
 *
 * The crossed state ALSO renders a polite announcement paragraph — it enters
 * the DOM with the state, so assistive tech hears the closing exactly once.
 * role="note" + aria-live="polite" deliberately: the submit-success region
 * must remain the page's ONLY role="status" (session.surfaces pins
 * getByRole('status') strict). When `id` is passed the notice is the
 * aria-describedby anchor for the menu's disabled add controls (D1): the
 * disabled button explains itself through THIS element.
 */
export function CutoffNotice({
  channel,
  hasLines,
  orderingClosed = false,
  id,
}: {
  channel: string
  hasLines: boolean
  orderingClosed?: boolean
  id?: string
}) {
  if (channel === 'dine-in') {
    return null
  }
  return (
    <>
      <p className={styles.cutoffNotice} role="note" id={id}>
        {channel === 'delivery'
          ? 'Once your delivery is on its way, you can no longer add items to this order.'
          : 'Once your takeaway order has been handed over, you can no longer add items to it.'}
        {hasLines ? ' Items already in your cart are safe.' : ''}
        {orderingClosed ? ' Adding is now closed for this order.' : ''}
      </p>
      {orderingClosed && (
        <p aria-live="polite" className={styles.cutoffClosed}>
          Adding is closed for this order — the timeline below shows exactly where it stands.
        </p>
      )}
    </>
  )
}
