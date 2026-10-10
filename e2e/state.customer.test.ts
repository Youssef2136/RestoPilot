import { expect, test, type Page } from '@playwright/test'
import { withT2Lock } from './helpers/t2Lock'

/**
 * Customer failure honesty E2E — US3 block (spec 037 T013; FR-04, FR-05,
 * SC-004).
 *
 * DETERMINISTIC INJECTION ONLY: the refusal and the timeout are delivered
 * by Playwright route interception on the round-submission RPC — the same
 * result on every run. Viewport is the 390×844 customer phone.
 *
 * Pinned behaviors: a refused submission keeps the cart and its lines
 * (nothing is ever cleared on failure), renders the injected message
 * verbatim inline, and re-enables the send button for an explicit retry; a
 * timed-out submission renders the unknown-result honesty line — never a
 * fabricated success.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

async function joinT2AndReachMenu(page: Page, name: string, phone: string): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T2' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
}

test('injected refusal on round submission keeps the cart and renders the message verbatim (FR-04, FR-05)', async ({
  page,
}) => {
  await withT2Lock(async () => {
    await joinT2AndReachMenu(page, 'State Refusal', '+15559100004')
    await page.getByRole('button', { name: 'Add to cart' }).first().click()
    // The cart's badge/count shows the line landed before the failure.
    await expect(page.getByRole('button', { name: 'Send order to the kitchen' })).toBeEnabled()

    // Inject the refusal at the RPC boundary: submit_round fails with a
    // deterministic server body; every other call passes through untouched.
    await page.route(/rest\/v1\/rpc\/submit_round/, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"message": "injected refusal — the kitchen closed early", "code": "P0001"}',
      }),
    )

    await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
    const refusal = page.getByRole('alert')
    await expect(refusal).toBeVisible()
    await expect(refusal).toContainText('injected refusal — the kitchen closed early')

    // The cart survives (FR-04): the lines are untouched, the submit is
    // re-enabled for an explicit retry (no stranded state).
    await expect(page.getByRole('button', { name: 'Send order to the kitchen' })).toBeEnabled()
  })
})

test('a timed-out submission renders the unknown-result honesty line, never fake success (FR-04)', async ({
  page,
}) => {
  await withT2Lock(async () => {
    await joinT2AndReachMenu(page, 'State Timeout', '+15559100005')
    await page.getByRole('button', { name: 'Add to cart' }).first().click()
    await expect(page.getByRole('button', { name: 'Send order to the kitchen' })).toBeEnabled()

    // Inject the timeout: the RPC never answers (the request is aborted
    // mid-flight) — the client's catch folds it into the retry-kind
    // unknown-result honesty message.
    await page.route(/rest\/v1\/rpc\/submit_round/, (route) => route.abort('connectionreset'))

    await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
    const refusal = page.getByRole('alert')
    await expect(refusal).toBeVisible()
    // The unknown-result honesty line: the round's outcome is NOT claimed.
    await expect(refusal).not.toContainText('ticket')
    // The cart survives again (the timeout clears nothing).
    await expect(page.getByRole('button', { name: 'Send order to the kitchen' })).toBeEnabled()
  })
})
