import { createContext, useContext } from 'react'

/**
 * Toast's shared contract (spec 022 T009): split from Toast.tsx so that file
 * exports only components (react-refresh/only-export-components). Consumers
 * import `useToast` from the barrel (src/components/ui/index.ts).
 */

export type ToastSeverity = 'info' | 'success' | 'warning' | 'danger'

export type ToastInput = {
  severity: ToastSeverity
  message: string
  action?: { label: string; onClick: () => void }
}

export type ToastEntry = ToastInput & { id: number }

export const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return context
}
