import { expect, test } from '@playwright/test'
import { withEntryLock } from './helpers/entryLock'

/**
 * specs/039 T009 — the PUBLIC GUEST's isolated role journey (US2/FR-02) at
 * 390×844 (the real customer device class): entry → menu → two rounds →
 * the customer poll's status visibility, plus the token isolation denial
 * (UI-level: a foreign token cannot drive this session's surface).
 *
 * The deterministic token-isolation injection: the session surface reads
 * the token from localStorage; planting a FOREIGN token makes every
 * session read resolve its honest unavailable/posture (the server refuses
 * the cross-session reach — the UI proves it never leaks the other
 * session's data).
 */
const SLUG = 'blue-olive'
/** A NON-EXISTENT token (invalid): the honest unavailable posture. The
 * demo dev tokens (e.g. downtown-t1) are LIVE sessions — planting one
 * would VALIDLY land its menu; the isolation denial needs the refused
 * token, not another tenant's working one. */
const FOREIGN_TOKEN = 'release-foreign-token-not-a-real-session'

test.describe.configure({ mode: 'serial' })

test('guest at 390px: entry, two rounds, status visibility; a foreign token is refused cleanly (FR-02)', async ({
  browser,
}) => {
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await guest.newPage()

  // Entry at 390px (the real device class for the customer journey).
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await page.getByLabel('Table').selectOption({ label: 'T3' })
    await page.getByLabel('Your name').fill('Release Guest 390')
    await page.getByLabel('Phone number').fill('+15559300003')
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()

  // Two rounds; the history grows by one per submission (the poll/realtime
  // fetch cadence bounds the wait — the round line may land within the
  // queue's 10 s poll window).
  const history = page.getByLabel('Your rounds')
  const roundLine = history.getByRole('listitem').filter({ hasText: /Round \d+ —/ })
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
  await expect(roundLine.first()).toBeVisible({ timeout: 20_000 })
  const one = await roundLine.count()
  expect(one).toBeGreaterThanOrEqual(1)
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(roundLine).toHaveCount(one + 1, { timeout: 20_000 })

  // THE TOKEN ISOLATION DENIAL: a foreign/invalid token replaces this
  // session's — the session surface resolves its honest posture (the
  // SERVER decides; the UI never continues the killed session's data):
  // the replaced session's OWN data (this guest's name and their rounds)
  // cannot render anymore, and the surface either states its unavailability
  // or returns to the entry posture — never the session's data.
  await page.evaluate((foreign) => {
    localStorage.setItem('restopilot.session-token', foreign)
  }, FOREIGN_TOKEN)
  await page.reload()
  const surfaceAfter = page.locator('main').first()
  const unavailable = page
    .getByText(/no longer available|couldn't|could not/i)
    .first()
    .or(page.getByRole('alert').first())
  const backToEntry = page.getByRole('heading', { level: 1, name: 'Blue Olive' })
  await expect(unavailable.or(backToEntry).or(surfaceAfter.getByText('Your name'))).toBeVisible({
    timeout: 15_000,
  })
  // The killed session's own data never renders (the isolation row's
  // substance at the UI level).
  const after = await surfaceAfter.innerText()
  expect(after, 'own-session data must not leak past the killed token').not.toContain(
    'Release Guest 390',
  )
  expect(after).not.toMatch(/Round \d+ —/)

  await guest.close()
})
