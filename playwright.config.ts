import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/setup/auth.setup.ts',

  // Fail fast on CI; run all on local
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial — avoids race conditions against shared Supabase DB

  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/setup/.auth-state.json',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    // auth.spec runs WITHOUT saved state (tests the login flow itself)
    {
      name: 'auth',
      testMatch: 'tests/auth.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },
    // all other specs reuse saved login cookies
    {
      name: 'app',
      testMatch: 'tests/*.spec.ts',
      testIgnore: 'tests/auth.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
