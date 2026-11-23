import { SCENARIOS } from '../../../../../test-data/addon-configs';
import { test, expect } from '../../../../../helpers/test';

test.describe('Full Regression > Option 1 > Stack + BrowZine Link > Article Record', () => {
  test.beforeEach(async ({ addon }) => {
    // this currently returns the default ARTICLE response from test-data/article.ts
    await addon.mockApis();
  });

  test('stack-plus-browzine renders the stacked options', async ({ addon }) => {
    await addon.useConfig(SCENARIOS.stackPlusBrowzineBase);
    await addon.gotoRecord();

    await expect(addon.stackContainer).toBeVisible();
    await expect(addon.noStackContainer).toHaveCount(0);
  });
});
