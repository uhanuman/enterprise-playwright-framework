import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const outputDir = process.env.OUTPUT_DIR ? path.resolve(process.env.OUTPUT_DIR) : path.resolve('output');

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: ['tests/steps/*.ts', 'src/framework/testBase.ts'],
  importTestFrom: './src/framework/testBase.ts',
  outputDir: path.join(outputDir, 'bdd'),
  verbose: true,
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  timeout: 30000,
  globalSetup: './src/framework/globalSetup.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000'
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(outputDir, 'reports', 'bdd') }],
    ['junit', { outputFile: path.join(outputDir, 'reports', 'bdd-junit.xml') }]
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});