import { SCENARIOS } from '../../../../../test-data/addon-configs';
import { LABELS } from '../../../../../helpers/addon-locators';
import { test, expect } from '../../../../../helpers/test';

test.describe('Full Regression > Option 1 > No Stack > Article Record', () => {
  test.beforeEach(async ({ addon }) => {
    // this currently returns the default ARTICLE response from test-data/article.ts
    await addon.mockApis();
  });

  test('no-stack with format choice shows PDF and article buttons', async ({ addon }) => {
    await addon.useConfig(SCENARIOS.noStackWithFormatChoice);
    await addon.gotoRecord();

    await expect(addon.noStackContainer).toBeVisible();
    await expect(addon.buttonLabels).toContainText([LABELS.pdf, LABELS.articleLink]);
  });

  test('PDF link disabled falls back to the article link', async ({ addon }) => {
    await addon.useConfig(SCENARIOS.noStackPdfLinkDisabled);
    await addon.gotoRecord();

    await expect(addon.buttonLabels.first()).toHaveText(LABELS.articleLink);
    await expect(addon.buttonLabels.filter({ hasText: LABELS.pdf })).toHaveCount(0);
  });
});
