/**
 * The design-system primitive library (spec 022; Master Plan §5.3/§5.4).
 * Surfaces import from here — never from deep paths — so the system is the
 * one visible dependency surface (FA-5). Amending the system is an explicit
 * act (docs/conventions.md §Amending the design system).
 */

export { Icon, type IconName, type IconProps } from './Icon'
export {
  Button,
  IconButton,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonProps,
} from './Button'
export { Field, type FieldProps } from './Field'
export { fieldControlClass, useFieldDescribedBy, type FieldRenderIds } from './fieldContext'
export { Input, NumberInput, Select, Textarea, type InputProps } from './Input'
export { Checkbox, RadioGroup, type CheckboxProps, type RadioGroupProps } from './Checkbox'
export { FormErrorSummary, type FormError } from './FormErrorSummary'
export { Dialog, ConfirmDialog, type DialogProps } from './Dialog'
export { Drawer, type DrawerProps } from './Drawer'
export {
  Card,
  Divider,
  Grid,
  Panel,
  SectionHeader,
  Stack,
  Tabs,
  Toolbar,
  type TabItem,
  type TabsProps,
} from './Structure'
export { useToast, type ToastInput, type ToastSeverity } from './toastTypes'
export { ToastProvider } from './Toast'
export { Alert, type AlertProps, type AlertSeverity } from './Alert'
export {
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
  Spinner,
  StatusPill,
  type StatusTone,
} from './Feedback'
export {
  DataTable,
  KeyValueList,
  LoadMore,
  Pagination,
  type DataTableColumn,
  type DataTableSort,
} from './DataTable'
export {
  MoneyText,
  StateChip,
  TotalsPanel,
  type DomainStatus,
  type TotalsGroup,
  type TotalsLine,
} from './MoneyText'
