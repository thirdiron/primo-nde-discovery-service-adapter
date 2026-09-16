/**
 * The only styles we intentionally apply to Primo's own elements.
 *
 * These can't travel the normal route. Component stylesheets go through `ScopedStylesHost`, which
 * rewrites every selector to match only inside our root element, and the elements targeted here are
 * *outside* it (`nde-online-availability` is a sibling of our wrapper). So we inject them as one
 * unscoped stylesheet, deliberately bypassing that host.
 *
 * Keep this list as small as possible, and qualify every selector with a `ti-` prefixed class that
 * only our own code applies — never a bare Primo selector.
 */

/** Identifies our injected stylesheet so repeated installs are no-ops. */
export const HOST_ELEMENT_OVERRIDES_STYLE_ID = 'ti-host-element-overrides';

/**
 * Marks Primo's native `nde-online-availability` as hidden while we're enhancing a record, so we
 * don't render duplicate buttons. Applied and removed by `PrimoAvailabilityDomController`, which
 * imports this constant rather than repeating the literal.
 */
export const ONLINE_AVAILABILITY_HIDDEN_CLASS = 'ti-online-availability-hidden';

/**
 * `!important` is required: Primo binds `display` on that element and writes it as an inline style,
 * which would otherwise outrank anything we declare here.
 */
export const HOST_ELEMENT_OVERRIDES_CSS = `
nde-online-availability.${ONLINE_AVAILABILITY_HIDDEN_CLASS} {
  display: none !important;
}
`;

/**
 * Appends the unscoped stylesheet to `document.head`, once per document.
 *
 * Idempotent by design: every custom element we register bootstraps through `AppModule`, so this
 * runs several times per page.
 */
export function installHostElementOverrides(doc: Document = document): void {
  if (doc.getElementById(HOST_ELEMENT_OVERRIDES_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = HOST_ELEMENT_OVERRIDES_STYLE_ID;
  style.textContent = HOST_ELEMENT_OVERRIDES_CSS;
  doc.head.appendChild(style);
}
