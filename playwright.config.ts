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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
