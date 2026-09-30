import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { signInAs } from './helpers/signInAs'

/**
 * Menu management E2E (spec 027 T008): the phase's NEW assertions over the
 * re-skinned surfaces — the owner's scratch build journey (create → edit →
 * extras → image → stop; legal cleanup only, since the RPC set has NO
 * item/category deletion for non-empty rows — spec Q2), the search/filter
 * with its filtered-empty state, the non-empty-category delete consequence
 * verbatim, the REALTIME availability effect on the customer-visible branch
 * view WITHOUT a manual refresh (the exit criterion), the 390px mobile
 * capability boundary, and the axe floor on the management route.
 *
 * Scratch design (spec): category 'E2E Scratch Menu' is created once and
 * REUSED (idempotent-by-reuse); items are named with a per-run suffix; items
 * are never deleted — they are stopped restaurant-wide (the legal off
 * switch), their extras retired and images removed. Scratch names are chosen
 * to never collide with the frozen menu.surfaces anchors (Hummus, Starters,
 * Mains, 'Extra …', etc.).
 *
 * Serial in one worker; fresh contexts keep the sign-in count under the Auth
 * rate limit.
 */

const MENU_URL = '/dashboard/menu'
const SCRATCH_CATEGORY = 'E2E Scratch Menu'

test.describe.configure({ mode: 'serial' })

/** The 1×1 PNG fixture (73 bytes — well under the 5 MB bound). */
const here = fileURLToPath(new URL('.', import.meta.url))
function fixtureImage() {
  return readFileSync(join(here, 'helpers', 'fixture-image.png'))
}

/**
 * Create-or-find the scratch category (duplicate names are refused verbatim —
 * 'A category with this name already exists.' — which is the find path).
 */
async function ensureScratchCategory(page: import('@playwright/test').Page) {
  const heading = page.getByRole('heading', { level: 3, name: SCRATCH_CATEGORY })
  if (await heading.isVisible().catch(() => false)) {
    return
  }
  const form = page.getByRole('region', { name: 'Add a category' })
  await form.getByLabel('Category name').fill(SCRATCH_CATEGORY)
  await form.getByRole('button', { name: 'Add category' }).click()
  await expect(heading).toBeVisible()
}

/**
 * Flip a branch availability toggle via the labelled checkbox control.
 */
async function setBranchToggle(
  page: import('@playwright/test').Page,
  itemName: string,
  on: boolean,
) {
  const branchSection = page.getByRole('region', { name: 'Branch availability' })
  const row = branchSection.locator('li').filter({ hasText: itemName }).first()
  const box = row.getByLabel(`"${itemName}" is available at this branch`)
  // The checkbox is controlled: its `checked` prop only updates after the
  // invalidate → refetch round-trip, so Playwright's check()/uncheck() —
  // which poll that state and retry the click — race the round-trip and can
  // toggle the row twice. Wait until the DOM actually shows the OPPOSITE of
  // the wanted state, then fire exactly one click; the caller asserts the
  // server's success text as the real state change.
  if (on) {
    await expect(box).not.toBeChecked()
  } else {
    await expect(box).toBeChecked()
  }
  await box.click()
  // The controlled prop lags the click by the invalidate → refetch round
  // trip; waiting for it here (and letting the caller assert the server's
  // success text) keeps a lost or doubled click from slipping through.
  if (on) {
    await expect(box).toBeChecked()
  } else {
    await expect(box).not.toBeChecked()
  }
  return row
}

/**
 * Create-or-find this run's scratch item (item names are not unique, so the
 * run suffix disambiguates; a reused category accumulates stopped items from
 * earlier runs — by design, all inert).
 */
async function ensureScratchItem(page: import('@playwright/test').Page, itemName: string) {
  const scratchRegion = page.getByRole('region', { name: SCRATCH_CATEGORY })
  if (
    await scratchRegion
      .getByText(itemName, { exact: false })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return
  }
  const itemForm = scratchRegion.getByRole('form', { name: 'Add an item to this category' })
  await itemForm.getByLabel('Item name').fill(itemName)
  await itemForm.getByLabel('Price', { exact: true }).fill('9.99')
  await itemForm.getByRole('button', { name: 'Add item' }).click()
  await expect(scratchRegion.getByText(itemName, { exact: false }).first()).toBeVisible()
}

test('the owner builds an item end-to-end: create, edit, extras, image, stop (FR-01/FR-03 exit criterion)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(MENU_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()

  // The section nav reaches both cards and reflects the fragment.
  const nav = page.getByRole('navigation', { name: 'Menu sections' })
  await nav.getByRole('button', { name: 'Add a category' }).click()
  await expect(page).toHaveURL(/#add-category/)
  await nav.getByRole('button', { name: 'Categories and items' }).click()

  await ensureScratchCategory(page)
  const itemName = `Scratch Item ${Date.now()}`
  await ensureScratchItem(page, itemName)

  const scratchRegion = page.getByRole('region', { name: SCRATCH_CATEGORY })

  // Edit: rename + exact two-decimal price. The save announces itself in
  // the editor's status region and the editor STAYS OPEN — its accessible
  // name follows the item's NEW name. The editor is a section hosting the
  // item-details form plus the extras/image forms (never nested forms).
  await scratchRegion.getByRole('button', { name: `Edit ${itemName}` }).click()
  const editor = page.getByRole('form', { name: `Item details for ${itemName}` })
  await editor.getByLabel('Name', { exact: true }).fill(`${itemName} revised`)
  await editor.getByLabel('Price', { exact: true }).fill('10.5')
  await editor.getByRole('button', { name: 'Save item' }).click()
  const revisedName = `${itemName} revised`
  const reopened = page.getByRole('form', { name: `Item details for ${revisedName}` })
  await expect(reopened.getByText(`"${revisedName}" updated.`)).toBeVisible()

  // Extras: add an extra, see it, retire it (retire is the legal removal).
  const extras = page.getByRole('region', { name: `Extras for ${revisedName}` })
  const addExtra = extras.getByRole('form', { name: `Add an extra to ${revisedName}` })
  await addExtra.getByLabel('Extra name').fill('Scratch extra')
  await addExtra.getByLabel('Price adjustment (optional)').fill('1.25')
  await addExtra.getByRole('button', { name: 'Add extra' }).click()
  await expect(extras.getByText('Scratch extra — +1.25')).toBeVisible()
  await extras.getByRole('button', { name: 'Retire Scratch extra' }).click()
  await expect(extras.getByText('Scratch extra — +1.25')).toHaveCount(0)

  // Image: the limits are shown BEFORE the attempt (frozen copy), the upload
  // lands, the preview renders (signed URL), and removal clears it. The
  // region's name is 'Image for item <id>' — prefix-matched.
  const imageSection = page.getByRole('region', { name: /Image for item/ }).first()
  await expect(
    imageSection.getByText('Add or replace (JPEG, PNG, or WebP; up to 5 MB)'),
  ).toBeVisible()
  await imageSection.getByLabel('Add or replace (JPEG, PNG, or WebP; up to 5 MB)').setInputFiles({
    name: 'scratch.png',
    mimeType: 'image/png',
    buffer: fixtureImage(),
  })
  await expect(imageSection.getByText('Image saved.')).toBeVisible()
  await expect(imageSection.locator('img')).toBeVisible()
  await imageSection.getByRole('button', { name: 'Remove image' }).click()
  await expect(imageSection.getByText('Image removed.')).toBeVisible()
  await expect(imageSection.locator('img')).toHaveCount(0)

  // The image remove invalidated the menu surface; give the refetch a beat
  // so the row's toggle is not mid-rerender when the next step clicks it.
  await page.waitForLoadState('networkidle').catch(() => {})

  // Stop restaurant-wide: the legal off switch + the verbatim blast radius
  // statement (FR-04). Click the checkbox directly: a controlled checkbox's
  // state flips only after the availability refetch lands, so uncheck()'s
  // state polling races the round trip (observed [disabled]-stuck retries).
  const stopLabel = scratchRegion
    .locator('label')
    .filter({ hasText: `"${itemName} revised" is available restaurant-wide` })
  await stopLabel.locator('input').click()
  await expect(scratchRegion.getByText('is stopped at every branch.')).toBeVisible()
})

test('the search filter narrows items and explains an empty result (FR-02)', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(MENU_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()

  // Narrow to Hummus: the Starters region keeps it, the others go empty.
  await page.getByLabel('Filter items').fill('hummus')
  const starters = page.getByRole('region', { name: 'Starters' })
  await expect(starters.getByText('Hummus', { exact: true })).toBeVisible()
  await expect(page.getByText('Grilled Halloumi', { exact: true })).toHaveCount(0)

  // A filter matching nothing renders the per-category filtered-empty state
  // (distinct from a truly empty category — the seeded ones have items).
  await page.getByLabel('Filter items').fill('zzzz-no-such-dish')
  await expect(page.getByText('No items match your filter.').first()).toBeVisible()
  await page.getByLabel('Filter items').fill('')
  await expect(page.getByText('Grilled Halloumi', { exact: true })).toBeVisible()
})

test('deleting a non-empty category is refused with the consequence verbatim (FR-01, Q2)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(MENU_URL)

  const starters = page.getByRole('region', { name: 'Starters' })
  await starters.getByRole('button', { name: 'Delete Starters' }).click()
  // The server's consequence message, verbatim — nothing disappears.
  await expect(
    starters.getByText('This category still contains items; move them to another category first.'),
  ).toBeVisible()
  await expect(starters.getByText('Hummus', { exact: false }).first()).toBeVisible()
})

test('a manager toggles branch availability and the customer-visible menu updates WITHOUT refresh (FR-05/FR-09 exit criterion)', async ({
  page,
  browser,
}) => {
  await signInAs(page, seedCredentials.bob)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown menu' })).toBeVisible()

  // Bob's read-only clarity is replaced by his own scope (phase-06 Q4): he
  // gets branch controls, no restaurant-wide section.
  await expect(page.getByRole('heading', { level: 2, name: 'Branch availability' })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Restaurant-wide availability' }),
  ).toHaveCount(0)

  // Residue guard: a previous run that crashed mid-test leaves Lamb Kebab's
  // Downtown override OFF in the database (the seed only restores it via
  // db:reset). The proof below needs the seeded baseline (offered
  // everywhere), so put the toggle back first if needed.
  const branchSection = page.getByRole('region', { name: 'Branch availability' })
  const kebabBox = branchSection
    .locator('li')
    .filter({ hasText: 'Lamb Kebab' })
    .first()
    .getByLabel('"Lamb Kebab" is available at this branch')
  if (!(await kebabBox.isChecked())) {
    await kebabBox.click()
    await expect(page.getByText('"Lamb Kebab" is offered at this branch again.')).toBeVisible()
    await expect(kebabBox).toBeChecked()
  }

  // A second browser holds the SAME page as the owner would see it — the
  // realtime proof: no reload happens there.
  const observer = await browser.newContext()
  const observerPage = await observer.newPage()
  await signInAs(observerPage, seedCredentials.alice)
  await observerPage.goto(`/dashboard/branches/${branchIds.downtown}/menu`)
  await expect(observerPage.getByRole('heading', { level: 1, name: 'Downtown menu' })).toBeVisible()
  // The customer-view toggle is local state on the preview — a click fired
  // while the page's realtime recovery refetch is still settling can be
  // reverted by the next controlled re-render, so click-and-VERIFY (retry a
  // lost toggle), then prove the filter applied: the staff-only pills (the
  // restaurant-wide stop on Sea Bass) must be gone from the customer view.
  const customerViewBox = observerPage.getByLabel(
    'Customer view (hide what customers will not see)',
  )
  for (let attempt = 0; attempt < 5 && !(await customerViewBox.isChecked()); attempt += 1) {
    await customerViewBox.click()
    await observerPage.waitForTimeout(250)
  }
  await expect(customerViewBox).toBeChecked()
  await expect(observerPage.getByText('(stopped restaurant-wide)')).toHaveCount(0)
  const customerMains = observerPage.getByRole('region', { name: 'Mains' })
  await expect(customerMains.getByText('Lamb Kebab')).toBeVisible()

  // Bob stops Lamb Kebab at Downtown (Lamb Kebab is offered everywhere in
  // the seed — the toggle is restored below, keeping the fixture stable for
  // the customer suites).
  const kebabRow = await setBranchToggle(page, 'Lamb Kebab', false)
  await expect(kebabRow.getByText('"Lamb Kebab" is unavailable at this branch.')).toBeVisible()

  // The observer's customer view drops the item WITHOUT any reload: the
  // realtime invalidation refetched the projection (exit criterion).
  await expect(customerMains.getByText('Lamb Kebab')).toHaveCount(0)
  await expect(
    observerPage.getByText('The customer view lists exactly the items this branch offers'),
  ).toBeVisible()

  // Bob restores the fixture (the toggle back on — the seeded state).
  await setBranchToggle(page, 'Lamb Kebab', true)
  await expect(page.getByText('"Lamb Kebab" is offered at this branch again.')).toBeVisible()
  await expect(customerMains.getByText('Lamb Kebab')).toBeVisible()

  await observer.close()
})

test('the 390px capability boundary hides the upload affordance and keeps edits (FR-10, Q3)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page, seedCredentials.alice)
  await page.goto(MENU_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()

  // Open Hummus's editor at mobile width: simple edits stay; the image
  // upload affordance is replaced by the boundary note (same DOM).
  await page
    .getByRole('region', { name: 'Starters' })
    .getByRole('button', { name: 'Edit Hummus' })
    .click()
  // The editor's accessible structure (T005): the `Edit Hummus` SECTION
  // carries the editor's name and hosts the `Item details for Hummus` form
  // (a form inside a form is invalid HTML, so the name lives on the section)
  // plus the extras and image blocks.
  const editor = page.getByRole('region', { name: 'Edit Hummus' })
  const details = editor.getByRole('form', { name: 'Item details for Hummus' })
  await expect(details.getByLabel('Name')).toBeVisible()
  await expect(editor.getByLabel('Price', { exact: true })).toBeVisible()
  await expect(
    editor.getByText(
      'Image uploads need a wider screen — add or replace the image on a tablet or desktop.',
    ),
  ).toBeVisible()
  await expect(editor.getByLabel('Add or replace (JPEG, PNG, or WebP; up to 5 MB)')).toBeHidden()

  // The item rows keep their actions reachable at 390px.
  await expect(page.getByRole('button', { name: 'Edit Hummus' })).toBeVisible()
})

test('the menu management route passes the axe WCAG 2.2 AA floor', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(MENU_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  await expectNoNewViolations(page, { route: MENU_URL })
})
