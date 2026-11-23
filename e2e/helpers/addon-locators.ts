import type { Page } from '@playwright/test';

// Button labels can be renamed per view in Alma (one sandbox view shows "View Article" where
// the add-on default is "Read Article"), so patterns accept the known variants.
export const LABELS = {
  pdf: /Download PDF/i,
  articleLink: /(Read|View) Article/i,
  retraction: /Retract/i,
};

/** Locators for the add-on's output on the first record on the page. */
export function addonLocators(page: Page) {
  // The NDE shell names the slot after the add-on's position, e.g.
  // nde-online-availability-before-from-remote-0, so match on the prefix.
  const slot = page
    .locator('xpath=//*[starts-with(local-name(), "nde-online-availability-before")]')
    .first();

  return {
    slot,
    /** Labels of the individual (non-stacked) buttons, in display order. */
    buttonLabels: slot.locator('[data-testid="ti-button-text"]'),
    /** Rendered for the no-stack view option. */
    noStackContainer: slot.locator('.ti-no-stack-container'),
    /** Rendered for the single-stack and stack-plus-browzine view options. */
    stackContainer: slot.locator('.ti-stack-options-container'),
  };
}
