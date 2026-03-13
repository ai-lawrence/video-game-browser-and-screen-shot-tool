import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for Electron E2E tests.
 *
 * Tests live in ./e2e/ and launch the built Electron app directly —
 * no webServer is needed because Electron manages its own renderer.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  }
})
