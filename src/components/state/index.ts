/**
 * The state vocabulary (spec 037): loading / empty / error / partial /
 * offline / refusal — a consistent visual family, not per-page inventions.
 * Usage rules live in `docs/conventions.md` (the Phase 037 vocabulary).
 */
export { Skeleton, type SkeletonProps, type SkeletonVariant } from './Skeleton'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { ErrorState, type ErrorStateProps } from './ErrorState'
export { RetryButton, type RetryButtonProps } from './RetryButton'
export { PartialFailureNotice, type PartialFailureNoticeProps } from './PartialFailureNotice'
export { OfflineSurface, type OfflineSurfaceProps } from './OfflineSurface'
export { useOfflineGate, useOfflineState, type OfflineGate } from './offlineGate'
export { RefusalAlert, type RefusalAlertProps } from './RefusalAlert'
