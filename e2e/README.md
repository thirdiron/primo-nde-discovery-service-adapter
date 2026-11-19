# LibKey add-on E2E tests

Playwright tests that run the LibKey add-on inside a real Primo NDE page and check which buttons it renders.

Most tests replace the add-on config that Primo delivers with a fixture and mock the Third Iron API. That way each test controls its own config and data, and nobody has to edit config.json in Alma between runs.

## Setup

The e2e tests need Node 20.12 or newer, because the config reads `e2e/.env` with `process.loadEnvFile`.

1. Install dependencies and the Playwright browser:
   ```bash
   npm install
   npm run e2e:install-browsers
   ```
2. Copy `e2e/.env.example` to `e2e/.env` and set `E2E_RECORD_URL`. Use a full-record page for an article with a DOI, on a Primo view whose add-on configuration includes LibKey.

   Paste the URL into the file, not on the command line. When a URL is pasted into a zsh command line, zsh adds a backslash before each `?`, `&` and `=`, which breaks it. The tests stop with a clear error if they see backslashes.

## Running

| Command                 | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `npm run e2e`           | Runs the suite headless                                              |
| `npm run e2e:headed`    | Runs the suite with a visible browser                                |
| `npm run e2e:ui`        | Opens Playwright's UI mode for picking, watching and debugging tests |
| `npm run e2e:report`    | Opens the HTML report from the last run                              |
| `npm run e2e:typecheck` | Type-checks the E2E code                                             |
| `npm run e2e:discover`  | Diagnostic: finds where Primo puts the add-on config (see below)     |

Failed tests keep a trace and a screenshot under `e2e/test-results/`. Open a trace with `npx playwright show-trace <path-to-trace.zip>`.

## How it works

The add-on gets its config from Alma by this path:

1. A library uploads config.json for a view in Alma.
2. When the page loads, Primo returns it in the view configuration response, `GET /primaws/rest/pub/configuration/vid/{vid}`, at `ndeAddons.LibKey.properties`. The same object's `url` is the add-on build the view loads.
3. The NDE shell passes those values into the add-on as `MODULE_PARAMETERS`, which `ConfigService` reads.

`useConfig()` intercepts the response in step 2, replaces `ndeAddons.LibKey.properties` with a fixture, and passes the response on. Everything after that point runs unchanged.

`mockApis()` answers the add-on's calls to the Third Iron API and Unpaywall with fixture data. Which buttons appear depends on the article data as much as on the config, so mock the APIs in every test except smoke tests.

Tests run against whichever add-on build the Primo view loads. That's set by the add-on URL in Alma, usually the /staging deploy. `useConfig(config, { addonUrl })` can point a run at a different build, but that option hasn't been tried yet.

## Layout

```
e2e/
  playwright.config.ts      Loads e2e/.env; "chromium" project runs tests/, "discovery" runs tools/
  test-data/
    addon-configs.ts        BASE_CONFIG and named SCENARIOS (complete configs, string values)
    article.ts              Third Iron article/journal data and articleResponse(overrides)
  helpers/
    test.ts                 `test` with the `addon` fixture; import test/expect from here
    addon-locators.ts       Locators for the add-on's output and LABELS patterns
    route-addon-config.ts   Swaps the config in Primo's response
    third-iron-api.ts       Third Iron and Unpaywall API mocks
  tests/
    full-regression/        Mirrors the Qase PRIMONDE suite tree (Full Regression > Option 1 > ...),
      option-1/             one lowercase kebab-case folder per suite
        no-stack/
          article-record/
            article-record.spec.ts   viewOption "no-stack": format choice, PDF link disabled
          article-status-signposting/
            article-alerts.spec.ts   Retraction alert, varying article data as well as config
        stack-plus-browzine-link/
          article-record/
            article-record.spec.ts   viewOption "stack-plus-browzine"
    smoke.spec.ts           Alma config and live data, no swap or mocks
  tools/
    find-config-request.spec.ts  Discovery diagnostic
```

## Writing a test

Import `test` and `expect` from `helpers/test`. The `addon` fixture gives each test:

- `addon.mockApis({ article? })` mocks the APIs. Call it before `gotoRecord()`.
- `addon.useConfig(config, { addonUrl? })` swaps the config. Call it before `gotoRecord()`.
- `addon.gotoRecord()` opens `E2E_RECORD_URL`.
- Locators: `addon.slot`, `addon.buttonLabels`, `addon.noStackContainer`, `addon.stackContainer`.

```ts
import { SCENARIOS } from '../test-data/addon-configs';
import { articleResponse } from '../test-data/article';
import { LABELS } from '../helpers/addon-locators';
import { test, expect } from '../helpers/test';

test('PDF link disabled falls back to the article link', async ({ addon }) => {
  await addon.mockApis({ article: articleResponse() });
  await addon.useConfig(SCENARIOS.noStackPdfLinkDisabled);
  await addon.gotoRecord();

  await expect(addon.buttonLabels.first()).toHaveText(LABELS.articleLink);
});
```

Guidelines:

- **Configs:** add a named scenario in `test-data/addon-configs.ts` built from `BASE_CONFIG`. Keep values as strings (`'true'`, not `true`), because that's how Primo sends them. `src/app/services/config.service.ts` shows what each key controls.
- **Article data:** use `articleResponse({ ... })`. For example, `retractionNoticeUrl`, `expressionOfConcernNoticeUrl`, `problematicJournalArticleNoticeUrl` and `documentDeliveryFulfillmentUrl` drive the alert and delivery buttons. The field types come from `src/app/types/tiData.types.ts`.
- **Button logic:** the order in which buttons are chosen is in `src/app/services/button-info.service.ts`. For example, "Read Article" only appears next to "Download PDF" when `showFormatChoice` is on.
- **Labels:** views can rename buttons in Alma. One sandbox view shows "View Article" instead of "Read Article". Match labels through `LABELS` so there's one place to adjust.
- **The swap guard:** if a test calls `useConfig()` but Primo's config request is never intercepted, the test fails with "Primo configuration request was never intercepted". Otherwise it would quietly test the Alma config.

## When Primo changes

The config location is part of Primo's undocumented API. If a release moves it, tests that use `useConfig()` fail with an error that mentions `ndeAddons.LibKey`. To find the new location:

1. Run `npm run e2e:discover`. It prints each response that carries the add-on's parameters, where they sit in the body, how values are written, and which add-on build loaded.
2. Update `CONFIG_REQUEST` and the property path in `helpers/route-addon-config.ts`.

Matching bodies are saved to `e2e/discovery-output/` (gitignored) with the API key redacted. They still contain the institution's config, so don't share them outside the team.

If the parameters stop arriving as JSON, response swapping can't work. The fallback is a test-only config override built into the add-on. Ask the add-on developers about it.

## Not covered yet

- Connect to Qase (qase-playwright reporter) and link test case ids
- Expression of concern, problematic journal, Unpaywall, document delivery and link resolver scenarios
- Journal records (`search?issns=` responses) and journal covers
- Search results pages with several records (the locators use the first record)
- Running in CI. The suite needs network access to a Primo sandbox view and an `E2E_RECORD_URL` secret.
