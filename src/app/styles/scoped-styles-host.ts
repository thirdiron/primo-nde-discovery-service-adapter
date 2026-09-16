import { DOCUMENT } from '@angular/common';
import { APP_ID, CSP_NONCE, Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { ɵSharedStylesHost as SharedStylesHost } from '@angular/platform-browser';
import { scopeCss } from './css-scope';

/**
 * Every stylesheet Angular injects on our behalf — our own component styles *and* the unscoped
 * stylesheets that Angular Material ships with `ViewEncapsulation.None` — passes through
 * `SharedStylesHost` on its way into the host page's `<head>`. Rewriting the CSS here is the single
 * choke point where we can guarantee none of it matches Primo's own markup.
 *
 * Shadow DOM is not an alternative: `ShadowDomRenderer` *adds* the shadow root as an extra style
 * host rather than replacing `document.head`, so the same CSS would be duplicated into the shadow
 * root and still leak. It would also strand the `mat-menu` overlay, which CDK portals to
 * `document.body`.
 *
 * Registered in `AppModule` to displace the instance `BrowserModule` provides.
 */
@Injectable()
export class ScopedStylesHost extends SharedStylesHost {
  constructor(
    @Inject(DOCUMENT) doc: Document,
    @Inject(APP_ID) appId: string,
    @Inject(CSP_NONCE) @Optional() nonce: string | null,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    super(doc, appId, nonce, platformId);
  }

  override addStyles(styles: string[]): void {
    super.addStyles(styles.map(scopeCss));
  }

  override removeStyles(styles: string[]): void {
    // Must apply the identical transform: the base class reference-counts styles by their exact
    // text, so removing the raw CSS would never match what `addStyles` registered.
    super.removeStyles(styles.map(scopeCss));
  }
}
