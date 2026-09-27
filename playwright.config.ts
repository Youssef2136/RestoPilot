import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  // A sign-in walks two real cloud round trips (the Auth API call and the
  // `current_auth_context` RPC) before SignInPage can navigate, and the
  // first tests of a session additionally pay the dev server's cold module
  // transform. The 5 s default expectation deadline is too tight for that
  // cold-start chain (FR-013 return-to checks flaked at exactly 5 s while
  // warm re-runs passed); 15 s gives the cloud round trips deterministic
  // headroom without weakening any assertion.
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Everything except the viewport smoke — the tagged specs below own it.
      testIgnore: '**/responsive.smoke.test.ts',
    },
    // Viewport projects (spec 021 FR-08): mobile 390×844, tablet 834×1112.
    // They run ONLY the viewport smoke suite so the E2E time budget stays
    // flat (the 13 existing suites remain chromium-only).
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
      testMatch: '**/responsive.smoke.test.ts',
    },
    {
      name: 'tablet-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1112 } },
      testMatch: '**/responsive.smoke.test.ts',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
