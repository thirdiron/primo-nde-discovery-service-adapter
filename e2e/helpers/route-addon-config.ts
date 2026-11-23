import type { Page } from '@playwright/test';
import type { AddonConfig } from '../test-data/addon-configs';

// Primo's view configuration response carries every add-on's settings under ndeAddons.<name>:
// `properties` holds the config.json values and `url` the add-on build to load.
// Confirmed on an Ex Libris sandbox, November 2026. If a Primo release moves it, run
// `npm run e2e:discover` to find the new location.
const CONFIG_REQUEST = /\/primaws\/rest\/pub\/configuration\/vid\//;
const ADDON_NAME = 'LibKey';

export type RouteOptions = {
  /** Load this add-on build instead of the one configured in Alma (e.g. a feature deploy). */
  addonUrl?: string;
};

/**
 * Serves `config` to the add-on in place of the config.json uploaded to Alma.
 * Returns a counter of intercepted config responses; the `addon` fixture checks it.
 */
export async function routeAddonConfig(page: Page, config: AddonConfig, opts: RouteOptions = {}) {
  const stats = { swapped: 0 };
  await page.route(CONFIG_REQUEST, async route => {
    const response = await route.fetch();
    const body = await response.json();
    const addon = body?.ndeAddons?.[ADDON_NAME];
    if (!addon) {
      throw new Error(
        `ndeAddons.${ADDON_NAME} missing from ${route.request().url()}. ` +
          'Has Primo changed the response format? Run `npm run e2e:discover`.'
      );
    }
    addon.properties = { ...config };
    if (opts.addonUrl) addon.url = opts.addonUrl;
    stats.swapped++;
    await route.fulfill({ response, json: body });
  });
  return stats;
}
