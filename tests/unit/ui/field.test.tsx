import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Checkbox,
  Field,
  FormErrorSummary,
  Input,
  NumberInput,
  RadioGroup,
  Select,
  Textarea,
} from '../../../src/components/ui'

/**
 * Form-control contracts (spec 022 FR-09/T012): label association, announced
 * errors, invalid/read-only wiring — the a11y plumbing forms re-invent.
 */

describe('Field contract (spec 022 T012)', () => {
  it('associates the label with the control id', () => {
    const html = renderToStaticMarkup(
      <Field label="Branch name">{(ids) => <Input id={ids.inputId} />}</Field>,
    )
    expect(html).toMatch(/<label [^>]*for="[^"]+"/)
    expect(html).toMatch(/<input [^>]*id="/)
    const forId = html.match(/for="([^"]+)"/)![1]
    expect(html).toContain(`id="${forId}"`)
  })

  it('renders the hint and wires aria-describedby', () => {
    const html = renderToStaticMarkup(
      <Field label="Phone" hint="Used for order updates">
        {(ids) => <Input id={ids.inputId} />}
      </Field>,
    )
    expect(html).toContain('Used for order updates')
    expect(html).toMatch(/aria-describedby="[^"]+-hint"/)
  })

  it('announces the error (role="alert") and marks the control invalid', () => {
    const message = 'Enter a valid phone number'
    const html = renderToStaticMarkup(
      <Field label="Phone" error={message}>
        {(ids) => <Input id={ids.inputId} invalid />}
      </Field>,
    )
    expect(html).toContain(`role="alert"`)
    expect(html).toContain(message) // verbatim
    expect(html).toMatch(/aria-invalid="true"/)
    expect(html).toMatch(/aria-describedby="[^"]+-error/)
  })

  it('marks required visually (the control keeps aria-required itself)', () => {
    const html = renderToStaticMarkup(
      <Field label="Name" required>
        {(ids) => <input id={ids.inputId} aria-required="true" />}
      </Field>,
    )
    expect(html).toContain('*')
    expect(html).toContain('aria-required="true"')
  })
})

describe('Control contracts (spec 022 T012)', () => {
  it('NumberInput stays text-mode (exact money text, no float parsing)', () => {
    const html = renderToStaticMarkup(<NumberInput />)
    expect(html).toContain('inputMode="decimal"')
    expect(html).not.toContain('type="number"')
  })

  it('Textarea and Select render their native elements', () => {
    expect(renderToStaticMarkup(<Textarea />)).toContain('<textarea')
    expect(
      renderToStaticMarkup(
        <Select>
          <option value="a">A</option>
        </Select>,
      ),
    ).toContain('<select')
  })

  it('Checkbox ties its label and never hides from AT', () => {
    const html = renderToStaticMarkup(<Checkbox label="Active" />)
    expect(html).toContain('type="checkbox"')
    const forId = html.match(/for="([^"]+)"/)![1]
    expect(html).toContain(`id="${forId}"`)
  })

  it('RadioGroup names itself via fieldset/legend', () => {
    const html = renderToStaticMarkup(
      <RadioGroup
        legend="Channel"
        name="ch"
        value="dine_in"
        onChange={() => {}}
        options={[
          { value: 'dine_in', label: 'Dine-in' },
          { value: 'delivery', label: 'Delivery' },
        ]}
      />,
    )
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
    expect(html).toContain('Channel')
    expect((html.match(/type="radio"/g) ?? []).length).toBe(2)
  })

  it('FormErrorSummary announces once and lists every failing field verbatim', () => {
    const html = renderToStaticMarkup(
      <FormErrorSummary
        errors={[
          { fieldId: 'f1', message: 'Name is required' },
          { fieldId: 'f2', message: 'Phone is invalid' },
        ]}
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Name is required')
    expect(html).toContain('Phone is invalid')
    // Plain text items (the fields' own inline errors are the actionable
    // path; summary jump links would be sub-floor touch targets).
    expect(html).not.toContain('href=')
  })
})
