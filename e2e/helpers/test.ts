import { test as base, expect, type Locator } from '@playwright/test';
import type { AddonConfig } from '../test-data/addon-configs';
import { addonLocators } from './addon-locators';
import { routeAddonConfig, type RouteOptions } from './route-addon-config';
import { mockThirdIronApis } from './third-iron-api';

export type AddonHarness = {
  /** Serve this config to the add-on instead of the Alma one. Call before gotoRecord(). */
  useConfig(config: AddonConfig, opts?: RouteOptions): Promise<void>;
  /** Mock the Third Iron and Unpaywall APIs. Call before gotoRecord(). */
  mockApis(opts?: { article?: object }): Promise<void>;
  /** Open the record page set in E2E_RECORD_URL. */
  gotoRecord(): Promise<void>;
  slot: Locator;
  buttonLabels: Locator;
  noStackContainer: Locator;
  stackContainer: Locator;
};

function recordUrl(): string {
  const url = process.env['E2E_RECORD_URL'];
  if (!url) {
    throw new Error('Set E2E_RECORD_URL in e2e/.env (see e2e/.env.example).');
  }
  if (url.includes('\\')) {
    throw new Error(
      'E2E_RECORD_URL contains backslashes, likely added by the shell on paste. Set it in e2e/.env.'
    );
  }
  return url;
}

/**
 * Playwright `test` with an `addon` fixture for driving the LibKey add-on inside Primo.
 * Import `test` and `expect` from here instead of from '@playwright/test'.
 */
export const test = base.extend<{ addon: AddonHarness }>({
  addon: async ({ page }, use, testInfo) => {
    const routes: { swapped: number }[] = [];

    await use({
      useConfig: async (config, opts) => {
        routes.push(await routeAddonConfig(page, config, opts));
      },
      mockApis: async opts => mockThirdIronApis(page, opts?.article),
      gotoRecord: async () => {
        await page.goto(recordUrl());
      },
      ...addonLocators(page),
    });

    // A test that passed while its config was never swapped would have been testing the
    // Alma config instead, so fail it.
    if (testInfo.status === 'passed') {
      const message = 'Primo configuration request was never intercepted';
      for (const stats of routes) {
        expect(stats.swapped, message).toBeGreaterThan(0);
      }
    }
  },
});

export { expect };
