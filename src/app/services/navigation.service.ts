import { Inject, Injectable, Optional, NgZone } from '@angular/core';
import { SHELL_ROUTER } from '../injection-tokens';
import { Router } from '@angular/router';

export type NavigationTarget = '_self' | '_blank';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(
    private ngZone: NgZone,
    @Optional() @Inject(SHELL_ROUTER) private shellRouter: Router | null
  ) {}

  /**
   * Navigates using the host/shell Angular Router when possible (for same-tab navigation),
   * otherwise falls back to browser navigation.
   */
  openUrl(rawUrl: string, target?: NavigationTarget): void {
    const url = (rawUrl ?? '').trim();
    if (!url) return;

    const resolvedTarget = target ?? this.inferTarget(url);

    // Same-tab navigation: prefer the host/shell router to preserve SPA behavior.
    if (resolvedTarget === '_self') {
      const routerUrl = this.toRouterUrl(url);
      if (this.shellRouter && routerUrl) {
        // Ensure we run inside Angular zone even if this code is invoked from a custom element.
        this.ngZone.run(() => {
          void this.shellRouter!.navigateByUrl(routerUrl);
        });
        return;
      }
    }

    // Browser navigation (new tab or same tab). Use window.open so it's spyable in tests.
    window.open(url, resolvedTarget);
  }

  /**
   * Convert an absolute/relative URL into a router-consumable URL (path+query+hash).
   * Returns null when we should not attempt SPA routing (e.g., external origin, non-http schemes).
   */
  private toRouterUrl(url: string): string | null {
    // Don't try to route special schemes.
    if (/^(mailto:|tel:|sms:|data:|blob:|javascript:)/i.test(url)) return null;

    // Fragment-only navigation is safe to pass to the router as-is.
    if (url.startsWith('#')) return url;

    let parsed: URL;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      return null;
    }

    // Only route within the current origin.
    if (parsed.origin !== window.location.origin) return null;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  /**
   * Default navigation behavior:
   * - same-origin URLs => open in same tab (and attempt SPA routing)
   * - external-origin / non-http(s) URLs => open in new tab
   */
  private inferTarget(url: string): NavigationTarget {
    // Fragment-only navigation should stay in-page.
    if (url.startsWith('#')) return '_self';

    // Non-http(s) schemes (mailto:, tel:, etc) are treated as "external".
    if (!/^(https?:)?\/\//i.test(url) && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      return '_blank';
    }

    let parsed: URL;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      // If we can't parse, safest is to open in a new tab.
      return '_blank';
    }

    return parsed.origin === window.location.origin ? '_self' : '_blank';
  }
}
