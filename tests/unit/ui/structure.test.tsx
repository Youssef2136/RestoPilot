import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Card,
  Divider,
  Drawer,
  Grid,
  KeyValueList,
  Pagination,
  Panel,
  SectionHeader,
  Skeleton,
  Stack,
  Tabs,
  ToastProvider,
  Toolbar,
  useToast,
} from '../../../src/components/ui'

/**
 * Structure/toast contracts (spec 022 FR-09/T012).
 */

describe('Structure contracts (spec 022 T012)', () => {
  it('SectionHeader renders the requested heading level', () => {
    const h2 = renderToStaticMarkup(<SectionHeader title="Sessions" />)
    expect(h2).toContain('<h2')
    const h3 = renderToStaticMarkup(<SectionHeader title="Sessions" level={3} />)
    expect(h3).toContain('<h3')
  })

  it('Toolbar exposes role="toolbar" with its accessible name', () => {
    const html = renderToStaticMarkup(
      <Toolbar label="Rounds actions">
        <button type="button">Accept</button>
      </Toolbar>,
    )
    expect(html).toContain('role="toolbar"')
    expect(html).toContain('aria-label="Rounds actions"')
  })

  it('Stack/Grid render layout containers', () => {
    expect(renderToStaticMarkup(<Stack>x</Stack>)).toMatch(/class="[^"]*stack/)
    expect(renderToStaticMarkup(<Grid>x</Grid>)).toMatch(/class="[^"]*grid/)
    expect(renderToStaticMarkup(<Card>x</Card>)).toMatch(/class="[^"]*card/)
    expect(renderToStaticMarkup(<Panel>x</Panel>)).toMatch(/class="[^"]*panel/)
    expect(renderToStaticMarkup(<Divider />)).toContain('<hr')
  })

  it('Tabs render the ARIA tablist contract with roving tabindex', () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Views"
        items={[
          { id: 'a', label: 'First' },
          { id: 'b', label: 'Second' },
        ]}
        value="b"
        onChange={() => {}}
      />,
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Views"')
    expect(html).toMatch(/aria-selected="true"/)
    expect(html).toMatch(/aria-selected="false"/)
    // Only the selected tab is in the tab order (roving tabindex).
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('tabindex="-1"')
  })

  it('KeyValueList renders dl semantics', () => {
    const html = renderToStaticMarkup(<KeyValueList items={[{ key: 'Branch', value: 'Maadi' }]} />)
    expect(html).toContain('<dl')
    expect(html).toContain('<dt')
    expect(html).toContain('<dd')
  })

  it('Pagination names itself and disables at bounds', () => {
    const html = renderToStaticMarkup(<Pagination page={1} pageCount={3} onPageChange={() => {}} />)
    expect(html).toContain('aria-label="Pagination"')
    expect(html).toContain('aria-label="Previous page"')
    expect(html).toContain('disabled=""')
  })

  it('Drawer renders nothing while closed', () => {
    expect(renderToStaticMarkup(<Drawer open={false} onClose={() => {}} title="Nav" />)).toBe('')
  })
})

describe('Toast contract (spec 022 T012)', () => {
  it('provides the context or throws a named error outside the provider', () => {
    expect(() => renderToStaticMarkup(<ToastProbe />)).toThrow(
      'useToast must be used inside <ToastProvider>',
    )
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>,
    )
    expect(html).toMatch(/role="status"/)
    expect(html).toContain('aria-label="Notifications"')
  })
})

function ToastProbe() {
  const toast = useToast()
  toast.show({ severity: 'success', message: 'Round submitted.' })
  return <Skeleton />
}
