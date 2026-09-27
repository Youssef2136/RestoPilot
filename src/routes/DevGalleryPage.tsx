import { useState } from 'react'
import { Link } from 'react-router'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  Divider,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FormErrorSummary,
  Grid,
  Icon,
  IconButton,
  Input,
  KeyValueList,
  LoadMore,
  MoneyText,
  NumberInput,
  Pagination,
  Panel,
  ProgressBar,
  RadioGroup,
  SectionHeader,
  Select,
  Skeleton,
  Spinner,
  Stack,
  StateChip,
  StatusPill,
  Tabs,
  Textarea,
  ToastProvider,
  Toolbar,
  TotalsPanel,
  useToast,
  type DomainStatus,
} from '../components/ui'
import styles from './DevGalleryPage.module.css'

/**
 * The dev-only design gallery (spec 021 FR-09; spec 022 FR-05): every
 * primitive in every state, grouped, labeled — static fixtures only (no
 * product copy, no tenant data). Registered behind `import.meta.env.DEV`
 * (router.tsx); production builds exclude the route entirely (spec 021 D3).
 *
 * Interactive state demos use local state; nothing persists. This page is
 * infrastructure for review and screenshot evidence.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function StateRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.stateRow}>
      <span className={styles.stateLabel}>{label}</span>
      <div className={styles.stateDemo}>{children}</div>
    </div>
  )
}

/** Interactive states that need a live document (hover/focus are physical). */
function ButtonsShowcase() {
  return (
    <>
      {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
        <StateRow key={variant} label={`Button ${variant}`}>
          <Stack gap="3">
            <div className={styles.rowButtons}>
              <Button variant={variant}>Default</Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
              <Button variant={variant} size="sm">
                Small
              </Button>
            </div>
          </Stack>
        </StateRow>
      ))}
      <StateRow label="IconButton">
        <div className={styles.rowButtons}>
          <IconButton icon="settings" label="Settings" />
          <IconButton icon="plus" label="Add" variant="primary" />
          <IconButton icon="x" label="Close" variant="ghost" size="sm" />
          <IconButton icon="search" label="Search" disabled />
        </div>
      </StateRow>
    </>
  )
}

function FieldsShowcase() {
  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const [number, setNumber] = useState('')
  const [select, setSelect] = useState('')
  const [radio, setRadio] = useState('dine_in')
  return (
    <Grid min="18rem" gap="6">
      <Field label="Default input" hint="Visible hint text">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Placeholder" />
      </Field>
      <Field
        label="Invalid input"
        error="Enter an amount like 12.50 — digits and up to two decimal places."
      >
        <Input invalid value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field label="Disabled input">
        <Input disabled value="Locked value" readOnly />
      </Field>
      <Field label="Textarea">
        <Textarea value={area} onChange={(e) => setArea(e.target.value)} />
      </Field>
      <Field label="Select">
        <Select value={select} onChange={(e) => setSelect(e.target.value)}>
          <option value="">Choose…</option>
          <option value="a">Option A</option>
          <option value="b">Option B</option>
        </Select>
      </Field>
      <Field label="NumberInput (money entry)">
        <NumberInput
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="0.00"
        />
      </Field>
      <div>
        <Checkbox label="Unchecked checkbox" />
        <div className={styles.spacerSm} />
        <Checkbox label="Checked checkbox" defaultChecked />
        <div className={styles.spacerSm} />
        <Checkbox label="Disabled checkbox" disabled />
      </div>
      <RadioGroup
        legend="Radio group"
        name="gallery-channel"
        value={radio}
        onChange={setRadio}
        options={[
          { value: 'dine_in', label: 'Dine-in' },
          { value: 'delivery', label: 'Delivery' },
          { value: 'takeaway', label: 'Takeaway', disabled: true },
        ]}
      />
      <div className={styles.spanFull}>
        <FormErrorSummary
          errors={[
            { fieldId: 'gallery-name', message: 'Name is required' },
            { fieldId: 'gallery-phone', message: 'Enter a valid phone number' },
          ]}
        />
      </div>
      <Field label="Name (summary target)" forId="gallery-name">
        <Input id="gallery-name" />
      </Field>
      <Field label="Phone (summary target)" forId="gallery-phone">
        <Input id="gallery-phone" />
      </Field>
    </Grid>
  )
}

function FeedbackShowcase() {
  const toast = useToast()
  const [alertDismissed, setAlertDismissed] = useState(false)
  return (
    <Stack gap="6">
      <div className={styles.rowButtons}>
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({
              severity: 'info',
              message: 'Order queued — the kitchen will accept it shortly.',
            })
          }
        >
          Toast info
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.show({ severity: 'success', message: 'Round submitted.' })}
        >
          Toast success
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({ severity: 'warning', message: 'Round locked for modifications.' })
          }
        >
          Toast warning
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({
              severity: 'danger',
              message: 'The kitchen refused the round.',
              action: { label: 'Review', onClick: () => {} },
            })
          }
        >
          Toast danger + action
        </Button>
      </div>
      <Stack gap="3">
        {!alertDismissed && (
          <Alert severity="info" title="Heads up" onDismiss={() => setAlertDismissed(true)}>
            This alert is dismissible; the caller owns the state.
          </Alert>
        )}
        <Alert severity="success" title="Saved">
          Restaurant profile updated.
        </Alert>
        <Alert severity="warning" title="Expiring soon">
          The subscription ends in 5 days.
        </Alert>
        <Alert severity="danger" title="Refused">
          The session already has a round out for delivery.
        </Alert>
        <Alert
          severity="info"
          action={
            <Button size="sm" variant="secondary">
              Open sessions
            </Button>
          }
        >
          Alert with an action slot.
        </Alert>
      </Stack>
      <StateRow label="StatusPill tones">
        <div className={styles.rowButtons}>
          <StatusPill tone="neutral">Neutral</StatusPill>
          <StatusPill tone="brand">Brand</StatusPill>
          <StatusPill tone="info">Info</StatusPill>
          <StatusPill tone="positive">Positive</StatusPill>
          <StatusPill tone="warning">Warning</StatusPill>
          <StatusPill tone="danger">Danger</StatusPill>
        </div>
      </StateRow>
      <StateRow label="StateChip (domain vocabulary)">
        <div className={styles.rowChips}>
          {(
            [
              'new',
              'accepted',
              'preparing',
              'ready',
              'lock',
              'out_for_delivery',
              'completed',
              'voided',
              'open',
              'closed',
              'active',
              'nearing_expiration',
              'expired',
              'never_activated',
              'available',
              'unavailable',
              'disabled',
            ] as DomainStatus[]
          ).map((status) => (
            <StateChip key={status} status={status} />
          ))}
        </div>
      </StateRow>
      <StateRow label="Spinner / Skeleton / ProgressBar">
        <Stack gap="4">
          <Spinner label="Loading sessions" />
          <div className={styles.skeletonRow}>
            <Skeleton height="1rem" width="30%" />
            <Skeleton height="1rem" width="55%" />
            <Skeleton height="2.5rem" width="100%" />
          </div>
          <ProgressBar value={62} label="Upload progress" />
        </Stack>
      </StateRow>
    </Stack>
  )
}

function OverlaysShowcase() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busyOpen, setBusyOpen] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tab, setTab] = useState('menu')
  return (
    <Stack gap="6">
      <div className={styles.rowButtons}>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Confirm dialog
        </Button>
        <Button variant="secondary" onClick={() => setBusyOpen(true)}>
          Busy dialog
        </Button>
        <Button variant="secondary" onClick={() => setErrorOpen(true)}>
          Error dialog
        </Button>
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          Drawer
        </Button>
      </div>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Close session for Table 4"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(false)}>
              Confirm closing
            </Button>
          </>
        }
      >
        <p>This closes the session and locks it from further rounds.</p>
      </Dialog>
      <Dialog
        open={busyOpen}
        onClose={() => setBusyOpen(false)}
        title="Saving changes"
        busy
        actions={
          <Button variant="secondary" disabled loading>
            Saving…
          </Button>
        }
      >
        <p>The mutation is in flight; actions are disabled.</p>
      </Dialog>
      <Dialog
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Refused"
        error="A session at this table is already open."
        actions={
          <Button variant="secondary" onClick={() => setErrorOpen(false)}>
            Understood
          </Button>
        }
      >
        <p>The server's message is rendered verbatim in the error slot.</p>
      </Dialog>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Navigation">
        <Stack gap="3">
          <a href="#gallery-overlays">Gallery overlays</a>
          <a href="#gallery-data">Gallery data</a>
        </Stack>
      </Drawer>
      <div>
        <Tabs
          label="Gallery tabs"
          items={[
            { id: 'menu', label: 'Menu' },
            { id: 'tax', label: 'Tax' },
            { id: 'staff', label: 'Staff' },
          ]}
          value={tab}
          onChange={setTab}
          panels={{
            menu: <p>Menu panel — arrow keys move focus.</p>,
            tax: <p>Tax panel.</p>,
            staff: <p>Staff panel.</p>,
          }}
        />
      </div>
    </Stack>
  )
}

type GalleryRow = { id: string; item: string; price: string; available: boolean }

function DataShowcase() {
  const rows: GalleryRow[] = [
    { id: '1', item: 'Grilled chicken', price: '85.00', available: true },
    { id: '2', item: 'Fattoush', price: '42.50', available: true },
    { id: '3', item: 'Kunafa', price: '38.00', available: false },
  ]
  return (
    <Stack gap="6">
      <DataTable
        caption="Menu items (fixture data)"
        columns={[
          { key: 'item', header: 'Item', render: (r) => r.item, sortable: true, minWidth: '12rem' },
          {
            key: 'price',
            header: 'Price',
            render: (r) => <MoneyText value={r.price} />,
            numeric: true,
          },
          {
            key: 'available',
            header: 'Available',
            render: (r) =>
              r.available ? (
                <StatusPill tone="positive">Yes</StatusPill>
              ) : (
                <StatusPill tone="danger">No</StatusPill>
              ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />
      <DataTable
        columns={[{ key: 'item', header: 'Item', render: () => '' }]}
        rows={[]}
        rowKey={() => ''}
        emptyMessage="No items yet — add your first menu item."
      />
      <DataTable
        columns={[{ key: 'item', header: 'Item', render: () => '' }]}
        rows={[]}
        rowKey={() => ''}
        loading
      />
      <Grid min="16rem" gap="6">
        <KeyValueList
          items={[
            { key: 'Branch', value: 'Maadi — Main' },
            { key: 'Tables', value: '12 active' },
            { key: 'Open sessions', value: '4' },
          ]}
        />
      </Grid>
      <Pagination page={2} pageCount={7} onPageChange={() => {}} />
      <LoadMore onMore={() => {}} />
    </Stack>
  )
}

function StructureShowcase() {
  return (
    <Grid min="16rem" gap="6">
      <Card>
        <SectionHeader title="Card" description="Raised surface, shadow-1" />
        <p className={styles.muted}>Body content inside a card.</p>
      </Card>
      <Panel>
        <SectionHeader title="Panel" description="Flat, denser staff variant" level={3} />
        <p className={styles.muted}>Body content inside a panel.</p>
      </Panel>
      <Card className={styles.spanFull}>
        <Toolbar label="Example toolbar">
          <Button size="sm" variant="secondary">
            Filter
          </Button>
          <Button size="sm" variant="secondary">
            Sort
          </Button>
          <Divider className={styles.dividerVertical} />
          <Button size="sm" variant="primary">
            New item
          </Button>
        </Toolbar>
        <EmptyState
          icon="sessions"
          title="No open sessions"
          action={<Button variant="secondary">View sessions guide</Button>}
        >
          Open sessions appear here as guests start ordering at your tables.
        </EmptyState>
        <Divider />
        <ErrorState
          message="get_branch_rounds failed: the branch is out of reach."
          onRetry={() => {}}
        />
      </Card>
      <Card>
        <SectionHeader title="Icons" description="Authored set, one stroke" level={3} />
        <div className={styles.iconRow}>
          {(
            [
              'dashboard',
              'sessions',
              'receipt',
              'kitchen',
              'chart',
              'shield',
              'plus',
              'minus',
              'x',
              'chevron-down',
              'chevron-left',
              'chevron-right',
              'check',
              'alert-triangle',
              'info',
              'user',
              'users',
              'settings',
              'logout',
              'search',
              'external',
            ] as const
          ).map((name) => (
            <span key={name} className={styles.iconCell} title={name}>
              <Icon name={name} size={20} />
            </span>
          ))}
        </div>
      </Card>
    </Grid>
  )
}

function TotalsShowcase() {
  return (
    <div className={styles.totalsWidth}>
      <TotalsPanel
        groups={[
          {
            key: 'rounds',
            heading: 'Rounds',
            lines: [
              { key: 'r1', label: 'Round 1 — 2 items', display: '127.00' },
              { key: 'r2', label: 'Round 2 — 1 item', display: '42.50', voided: true },
              { key: 'r3', label: 'Round 3 — 3 items', display: '210.75' },
            ],
          },
          {
            key: 'taxes',
            heading: 'Taxes (server-computed)',
            lines: [
              { key: 't1', label: 'VAT 14%', display: '47.25', kind: 'emphasis' },
              { key: 't2', label: 'Service 12%', display: '40.50' },
            ],
          },
        ]}
        grandTotal={{ key: 'total', label: 'Grand total (non-voided)', display: '425.50' }}
        footer="Amounts render exactly as the server computed them."
      />
    </div>
  )
}

/**
 * The live error-boundary proof (spec 021 US1 acceptance, kept).
 */
function ErrorTrigger() {
  const [armed, setArmed] = useState(false)
  if (armed) {
    throw new Error('Intentional dev-gallery render error (ErrorBoundary proof)')
  }
  return (
    <Button variant="ghost" onClick={() => setArmed(true)}>
      Trigger a render error (dev proof)
    </Button>
  )
}

function GalleryContent() {
  return (
    // The AppShell owns the single <main id="main"> landmark (skip-link
    // target); the gallery renders INSIDE it — no nested/duplicate landmark.
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Dev gallery</h1>
        <p className={styles.lede}>
          Development-only preview of the design system (spec 022 FR-05): every primitive in every
          state. This route does not exist in production builds.
        </p>
        <p>
          <Link to="/">Entry page link</Link> · <Link to="/signin">Sign-in link</Link>
        </p>
      </header>

      <Section title="Buttons">
        <ButtonsShowcase />
      </Section>

      <Section title="Fields & forms">
        <FieldsShowcase />
      </Section>

      <Section title="Feedback">
        <FeedbackShowcase />
      </Section>

      <Section title="Overlays">
        <div id="gallery-overlays">
          <OverlaysShowcase />
        </div>
      </Section>

      <Section title="Data">
        <div id="gallery-data">
          <DataShowcase />
        </div>
      </Section>

      <Section title="Structure & icons">
        <StructureShowcase />
      </Section>

      <Section title="Money & totals">
        <TotalsShowcase />
      </Section>

      <Section title="Density (compact mode)">
        <div data-density="compact" className={styles.compactDemo}>
          <Card>
            <SectionHeader
              title="Compact density"
              description="data-density=compact on a surface root"
              level={3}
            />
            <div className={styles.rowButtons}>
              <Button size="sm" variant="primary">
                Accept
              </Button>
              <Button size="sm" variant="secondary">
                Modify
              </Button>
              <Button size="sm" variant="ghost">
                Void
              </Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Recovery views (inert demos)">
        <p className={styles.muted}>
          The error and not-found views render through <code>ErrorBoundary</code> and the{' '}
          <code>*</code> route; the live proof:
        </p>
        <ErrorTrigger />
      </Section>
    </div>
  )
}

export function DevGalleryPage() {
  return (
    <ToastProvider>
      <GalleryContent />
    </ToastProvider>
  )
}
