import type { Page } from '@playwright/test';
import { articleResponse } from '../test-data/article';

const isThirdIron = (url: URL, path: string) =>
  url.hostname === 'public-api.thirdiron.com' && url.pathname.includes(path);

/**
 * Mocks the Third Iron and Unpaywall APIs so the buttons depend only on the test's data.
 * The article response is served for every DOI, so the record only needs to be an article.
 */
export async function mockThirdIronApis(page: Page, article: object = articleResponse()) {
  await page.route(
    url => isThirdIron(url, '/articles/doi/'),
    route => route.fulfill({ json: article })
  );
  await page.route(
    url => isThirdIron(url, '/search'),
    route => route.fulfill({ json: { data: [] } })
  );
  await page.route(
    url => url.hostname === 'api.unpaywall.org',
    route => route.fulfill({ status: 404, json: {} })
  );
}
