import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup-env.ts'],
    // Every database suite runs against the remote cloud dev project; round
    // trips occasionally exceed Vitest's 5s default under load.
    testTimeout: 30_000,
  },
})
