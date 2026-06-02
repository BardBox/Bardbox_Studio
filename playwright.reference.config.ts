import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 300_000,
  use: {
    baseURL: 'https://thebardbox.5day.io',
    storageState: { cookies: [], origins: [] },
    screenshot: 'on',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'reference',
      testMatch: 'tests/analyze-reference.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },
  ],
});
