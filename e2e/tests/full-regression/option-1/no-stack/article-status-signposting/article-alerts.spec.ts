import { BASE_CONFIG, SCENARIOS } from '../../../../../test-data/addon-configs';
import { articleResponse } from '../../../../../test-data/article';
import { LABELS } from '../../../../../helpers/addon-locators';
import { test, expect } from '../../../../../helpers/test';

// Example of varying the article data as well as the config.
const retractedArticle = articleResponse({
  retractionNoticeUrl: 'https://e2e.example.org/retraction-notice',
});

test.describe('Full Regression > Option 1 > No Stack > Article Status Signposting', () => {
  test('retracted article shows the retraction alert instead of the PDF link', async ({
    addon,
  }) => {
    await addon.mockApis({ article: retractedArticle });
    await addon.useConfig(BASE_CONFIG);
    await addon.gotoRecord();

    await expect(addon.buttonLabels.first()).toHaveText(LABELS.retraction);
    await expect(addon.buttonLabels.filter({ hasText: LABELS.pdf })).toHaveCount(0);
  });

  test('retraction watch disabled shows the PDF link for a retracted article', async ({
    addon,
  }) => {
    await addon.mockApis({ article: retractedArticle });
    await addon.useConfig(SCENARIOS.noStackRetractionDisabled);
    await addon.gotoRecord();

    await expect(addon.buttonLabels.first()).toHaveText(LABELS.pdf);
    await expect(addon.buttonLabels.filter({ hasText: LABELS.retraction })).toHaveCount(0);
  });
});
