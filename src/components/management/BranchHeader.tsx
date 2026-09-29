import styles from './management.module.css'

/**
 * BranchHeader (spec 026 T001): the branch identity header — the h1 name
 * (the pinned anchor) with room for meta chips. Deliberately thin: the h1
 * text contract is frozen, the layout is ours.
 */
export function BranchHeader({ name, meta }: { name: string; meta?: React.ReactNode }) {
  return (
    <header className={styles.branchHeader}>
      <h1 className={styles.branchName}>{name}</h1>
      {meta !== undefined && <div className={styles.branchMeta}>{meta}</div>}
    </header>
  )
}
