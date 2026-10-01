import styles from '../staffOps.surfaces.module.css'

/**
 * The verbatim refusal paragraph (specs/029 FR-09): whichever mutation
 * failed for a round renders the server's message ON that round's card —
 * never silence, never a paraphrase. The `data-refusal` hook is the pinned
 * presentation anchor.
 */
export function RefusalText({ message }: { message: string }) {
  return (
    <p role="alert" data-refusal className={styles.voidedNote}>
      {message}
    </p>
  )
}
