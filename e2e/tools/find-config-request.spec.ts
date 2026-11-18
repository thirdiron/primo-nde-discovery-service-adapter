import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Run with `npm run e2e:discover`.
//
// Loads E2E_RECORD_URL and reports every response that carries the add-on's parameters:
// the URL, where the parameters sit in the body, and how values are encoded. Use it when
// helpers/route-addon-config.ts stops finding ndeAddons.LibKey after a Primo release.
// Matching bodies are saved to e2e/discovery-output/ (gitignored) with the API key redacted.
// They still contain the institution's config, so don't share them outside the team.

// Keys from our config.json. A response is reported when it assigns two or more of them.
const MARKERS = [
  'articlePDFDownloadLinkEnabled',
  'libraryId',
  'viewOption',
  'unpaywallEmailAddressKey',
];

// Matches `"key":` and the escaped `\"key\":` used inside JSON strings. A plain mention of the
// key does not match, so our own add-on bundle (which has getParam('libraryId')) is skipped.
const assignmentOf = (key: string) => new RegExp(`\\\\?"${key}\\\\?"\\s*:`);

const OUT_DIR = join(__dirname, '..', 'discovery-output');

type Location = { path: string; encoding: 'nested object' | 'JSON string'; pdfFlag: string };

/** Finds every object in a parsed body that holds two or more marker keys. */
function locateParams(
  node: unknown,
  path = '$',
  encoding: Location['encoding'] = 'nested object',
  out: Location[] = []
) {
  if (typeof node === 'string') {
    if (assignmentOf('libraryId').test(node) || assignmentOf('viewOption').test(node)) {
      try {
        locateParams(JSON.parse(node), path, 'JSON string', out);
      } catch {
        // not JSON, ignore
      }
    }
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  if (!Array.isArray(node) && MARKERS.filter(key => key in node).length >= 2) {
    const pdfFlag = JSON.stringify(
      (node as Record<string, unknown>)['articlePDFDownloadLinkEnabled']
    );
    out.push({ path, encoding, pdfFlag });
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    locateParams(value, Array.isArray(node) ? `${path}[${key}]` : `${path}.${key}`, encoding, out);
  }
  return out;
}

const redact = (body: string) => body.replace(/(\\?"apiKey\\?"\s*:\s*\\?")[^"\\]*/g, '$1REDACTED');

test('find the request that carries the add-on parameters', async ({ page }) => {
  test.setTimeout(120_000);
  const recordUrl = process.env['E2E_RECORD_URL'];
  if (!recordUrl) throw new Error('Set E2E_RECORD_URL in e2e/.env (see e2e/.env.example).');
  if (recordUrl.includes('\\')) {
    throw new Error('E2E_RECORD_URL contains backslashes, likely added by the shell on paste.');
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const reports: string[] = [];
  const addonBundles = new Set<string>();
  const pending: Promise<void>[] = [];

  page.on('response', res => {
    pending.push(
      (async () => {
        const url = res.url();
        if (/remoteEntry\.js(\?|$)/.test(url)) addonBundles.add(url);

        const type = res.headers()['content-type'] ?? '';
        if (!/json|javascript|html|text/.test(type)) return;
        const body = await res.text().catch(() => '');
        if (MARKERS.filter(key => assignmentOf(key).test(body)).length < 2) return;

        const n = String(reports.length + 1).padStart(2, '0');
        const slug = new URL(url).pathname.replace(/[^a-z0-9]+/gi, '_').slice(-60);
        const file = join(OUT_DIR, `${n}-${slug}.txt`);
        writeFileSync(file, redact(body));

        const lines = [
          `${n}. ${res.request().method()} ${url}`,
          `    content-type: ${type}`,
          `    saved: ${relative(process.cwd(), file)}`,
        ];
        if (type.includes('json')) {
          const locations = locateParams(JSON.parse(body));
          for (const loc of locations) {
            lines.push(
              `    parameters at ${loc.path} (${loc.encoding}); articlePDFDownloadLinkEnabled = ${loc.pdfFlag}`
            );
          }
          if (!locations.length) {
            lines.push('    keys present, but no single object holds them; inspect the saved body');
          }
        } else {
          lines.push(
            '    NOT JSON: parameters are embedded in a page or script; response swapping will not work'
          );
        }
        reports.push(lines.join('\n'));
      })()
    );
  });

  await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
  // Primo keeps some connections open, so cap the wait instead of requiring an idle network.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
  await Promise.all(pending);

  const slotCount = await page
    .locator('xpath=//*[starts-with(local-name(), "nde-online-availability-before")]')
    .count();

  console.log('\n=== Add-on config discovery ===');
  console.log(`Page: ${page.url()}`);
  console.log(
    `Add-on bundle(s) loaded: ${addonBundles.size ? [...addonBundles].join(', ') : 'none seen'}`
  );
  console.log(`LibKey slots on page: ${slotCount}`);
  if (reports.length) {
    console.log(`\nResponses carrying the add-on parameters:\n${reports.join('\n\n')}`);
  } else {
    console.log('\nNo response carried the add-on parameters.');
    console.log(
      'If no add-on bundle was seen either, the view may not include the add-on, or the URL may not show a record.'
    );
  }
});
