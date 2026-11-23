import { test, expect } from '../helpers/test';

// No config swap and no API mocks: the add-on runs with the config.json uploaded in Alma and
// live Third Iron data. This keeps the real Alma -> Primo -> add-on path covered.
// Assertions stay loose because both the Alma config and the live data can change.
test('add-on renders with the Alma config and live data', async ({ addon }) => {
  await addon.gotoRecord();

  await expect(addon.noStackContainer.or(addon.stackContainer)).toBeVisible();
});
