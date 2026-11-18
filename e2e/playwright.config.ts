import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Settings live in e2e/.env (copy e2e/.env.example). Keep URLs out of the command line:
// zsh adds a backslash before ?, & and = when a URL is pasted there, which breaks the URL.
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  // process.loadEnvFile arrived in Node 20.12. Fail clearly instead of with a TypeError.
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error(
      `The e2e tests need Node 20.12 or newer; this is Node ${process.versions.node}.`
    );
  }
  process.loadEnvFile(envFile);
}

const isCI = !!process.env['CI'];

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    // Requests made by a service worker skip page.route(). Blocking service workers makes
    // sure the Primo config request and the Third Iron API calls pass through our routes.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testDir: './tests', use: { ...devices['Desktop Chrome'] } },
    // Diagnostic run with `npm run e2e:discover`. Not part of the regular suite.
    { name: 'discovery', testDir: './tools', use: { ...devices['Desktop Chrome'] } },
  ],
});
