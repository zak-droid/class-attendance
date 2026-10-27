import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', globalSetup: './setup.ts', timeout: 65000, fullyParallel: true, workers: 2,
  reporter: [['list'], ['html', { outputFolder: resolve('playwright-report/updates'), open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
