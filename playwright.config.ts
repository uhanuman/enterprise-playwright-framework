import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const outputDir = process.env.OUTPUT_DIR ? path.resolve(process.env.OUTPUT_DIR) : path.resolve('output');
const workers = process.env.WORKERS ? Number(process.env.WORKERS) : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers,
  timeout: 30000,
  expect: { timeout: 10000 },
  globalSetup: './src/framework/globalSetup.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000'
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(outputDir, 'reports') }],
    ['junit', { outputFile: path.join(outputDir, 'reports', 'junit.xml') }]
  ],
  outputDir: path.join(outputDir, 'test-results'),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
