import styles from './order.surfaces.module.css'

/**
 * CutoffNotice (spec 025 T008; FR-08): the cutoff presented AS A STATE, not
 * a submit-time surprise. The server still refuses authoritatively (the
 * preserved-cart-above-cutoff E2E pin exercises that verbatim path); this
 * notice explains why continuation is closed while the customer is still
 * browsing. Channels only: dine-in has no cutoff.
 *
 * The cutoff fires when the session's order is already on its way (the
 * dispatch transition) — the same rule the refusal enforces — so the notice
 * rides the session-context echo rather than guessing from the history.
 */
export function CutoffNotice({ channel, hasLines }: { channel: string; hasLines: boolean }) {
  if (channel === 'dine-in') {
    return null
  }
  // role="note" deliberately: the submit-success region must remain the page's
  // ONLY role="status" (session.surfaces pins getByRole('status') strict).
  return (
    <p className={styles.cutoffNotice} role="note">
      {channel === 'delivery'
        ? 'Once your delivery is on its way, you can no longer add items to this order.'
        : 'Once your takeaway order has been handed over, you can no longer add items to it.'}
      {hasLines ? ' Items already in your cart are safe.' : ''}
    </p>
  )
}
