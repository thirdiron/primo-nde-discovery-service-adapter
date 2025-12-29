import { Inject, Injectable, Optional, NgZone } from '@angular/core';
import { SHELL_ROUTER } from '../injection-tokens';
import { Router } from '@angular/router';
import { DebugLogService } from './debug-log.service';

export type NavigationTarget = '_self' | '_blank';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(
    private ngZone: NgZone,
    @Optional() @Inject(SHELL_ROUTER) private shellRouter: Router | null,
    private debugLog: DebugLogService
  ) {}

  /**
   * Navigates using the host/shell Angular Router when possible (for same-tab navigation),
   * otherwise falls back to browser navigation.
   */
  openUrl(rawUrl: string, target?: NavigationTarget): void {
    const url = (rawUrl ?? '').trim();
    if (!url) {
      this.debugLog.debug('Navigation.openUrl.skip.emptyUrl', { rawUrl });
      return;
    }

    this.debugLog.debug('Navigation.openUrl.start', {
      url: this.debugLog.redactUrlTokens(url),
      target,
      locationOrigin: window.location.origin,
      hasShellRouter: !!this.shellRouter,
    });

    const resolvedTarget = target ?? this.inferTarget(url);
    this.debugLog.debug('Navigation.openUrl.resolvedTarget', {
      url: this.debugLog.redactUrlTokens(url),
      resolvedTarget,
    });

    // Same-tab navigation: prefer the host/shell router to preserve SPA behavior.
    if (resolvedTarget === '_self') {
      const routerUrl = this.toRouterUrl(url);
      this.debugLog.debug('Navigation.openUrl.sameTab', {
        url: this.debugLog.redactUrlTokens(url),
        routerUrl,
        willAttemptRouter: !!this.shellRouter && !!routerUrl,
      });
      if (this.shellRouter && routerUrl) {
        // Ensure we run inside Angular zone even if this code is invoked from a custom element.
        this.debugLog.debug('Navigation.openUrl.router.navigateByUrl', {
          routerUrl,
        });
        this.ngZone.run(() => {
          void this.shellRouter!.navigateByUrl(routerUrl);
        });
        return;
      }
    }

    // Browser navigation (new tab or same tab). Use window.open so it's spyable in tests.
    this.debugLog.debug('Navigation.openUrl.window.open', {
      url: this.debugLog.redactUrlTokens(url),
      target: resolvedTarget,
    });
    window.open(url, resolvedTarget);
  }

  /**
   * Convert an absolute/relative URL into a router-consumable URL (path+query+hash).
   * Returns null when we should not attempt SPA routing (e.g., external origin, non-http schemes).
   */
  private toRouterUrl(url: string): string | null {
    // Don't try to route special schemes.
    if (/^(mailto:|tel:|sms:|data:|blob:|javascript:)/i.test(url)) {
      this.debugLog.debug('Navigation.toRouterUrl.skip.scheme', {
        url: this.debugLog.redactUrlTokens(url),
      });
      return null;
    }

    // Fragment-only navigation is safe to pass to the router as-is.
    if (url.startsWith('#')) return url;

    let parsed: URL;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      this.debugLog.warn('Navigation.toRouterUrl.parseError', {
        url: this.debugLog.redactUrlTokens(url),
      });
      return null;
    }

    // Only route within the current origin.
    if (parsed.origin !== window.location.origin) {
      this.debugLog.debug('Navigation.toRouterUrl.skip.externalOrigin', {
        url: this.debugLog.redactUrlTokens(url),
        urlOrigin: parsed.origin,
        locationOrigin: window.location.origin,
      });
      return null;
    }

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
      this.debugLog.warn('Navigation.inferTarget.parseError', {
        url: this.debugLog.redactUrlTokens(url),
      });
      return '_blank';
    }

    const inferred: NavigationTarget =
      parsed.origin === window.location.origin ? '_self' : '_blank';
    this.debugLog.debug('Navigation.inferTarget.result', {
      url: this.debugLog.redactUrlTokens(url),
      inferred,
      urlOrigin: parsed.origin,
      locationOrigin: window.location.origin,
    });
    return inferred;
  }
}
