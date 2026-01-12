import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { SHELL_ROUTER } from '../injection-tokens';
import { NavigationService } from './navigation.service';
import { DebugLogService } from './debug-log.service';

describe('NavigationService', () => {
  let service: NavigationService;

  const makeNgZone = () => new NgZone({ enableLongStackTrace: false });

  describe('with shell router', () => {
    let routerNavigateByUrl: jasmine.Spy;

    beforeEach(() => {
      routerNavigateByUrl = jasmine
        .createSpy('navigateByUrl')
        .and.returnValue(Promise.resolve(true));

      TestBed.configureTestingModule({
        providers: [
          NavigationService,
          DebugLogService,
          { provide: NgZone, useFactory: makeNgZone },
          {
            provide: SHELL_ROUTER,
            useValue: {
              navigateByUrl: routerNavigateByUrl,
            },
          },
        ],
      });

      service = TestBed.inject(NavigationService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('uses router.navigateByUrl for same-origin absolute URLs (same-tab)', () => {
      const origin = window.location.origin;
      const url = `${origin}/fulldisplay#nui.getit.service_viewit`;

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      expect(routerNavigateByUrl).toHaveBeenCalledWith('/fulldisplay#nui.getit.service_viewit');
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('uses router.navigateByUrl for same-origin relative URLs (same-tab)', () => {
      const url = '/some/path';

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      expect(routerNavigateByUrl).toHaveBeenCalledWith(url);
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('re-applies hash after router navigation for fulldisplay links (patch to fix scrolling issue)', fakeAsync(() => {
      const origin = window.location.origin;
      const url = `${origin}/fulldisplay?x=1#nui.getit.service_viewit`;

      window.location.hash = '';

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      // navigateByUrl should be called immediately
      expect(routerNavigateByUrl).toHaveBeenCalledWith('/fulldisplay?x=1#nui.getit.service_viewit');
      expect(openSpy).not.toHaveBeenCalled();

      // Hash re-apply scheduled (0ms and 250ms). Tick enough to run the first attempt.
      tick(0);
      expect(window.location.hash).toBe('#nui.getit.service_viewit');

      // Second attempt should not break anything.
      tick(250);
      expect(window.location.hash).toBe('#nui.getit.service_viewit');
    }));

    it('does not use router.navigateByUrl for external-origin URLs (opens new tab)', () => {
      const url = 'https://example.com/external/link';

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      expect(routerNavigateByUrl).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(url, '_blank');
    });

    it('respects explicit target override (_blank) even for same-origin URLs', () => {
      const origin = window.location.origin;
      const url = `${origin}/fulldisplay?#nui.getit.service_viewit`;

      const openSpy = spyOn(window, 'open');
      service.openUrl(url, '_blank');

      expect(routerNavigateByUrl).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(url, '_blank');
    });

    it('passes fragment-only urls through to router.navigateByUrl', () => {
      const openSpy = spyOn(window, 'open');
      service.openUrl('#nui.getit.service_viewit');

      expect(routerNavigateByUrl).toHaveBeenCalledWith('#nui.getit.service_viewit');
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('opens mailto: links in a new tab/window (no routing)', () => {
      const url = 'mailto:test@example.com';

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      expect(routerNavigateByUrl).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(url, '_blank');
    });
  });

  describe('without shell router', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          NavigationService,
          DebugLogService,
          { provide: NgZone, useFactory: makeNgZone },
        ],
      });

      service = TestBed.inject(NavigationService);
    });

    it('opens same-origin URLs in the same tab when no router is available', () => {
      const url = '/fulldisplay?#nui.getit.service_viewit';

      const openSpy = spyOn(window, 'open');
      service.openUrl(url);

      expect(openSpy).toHaveBeenCalledWith(url, '_self');
    });

    it('does nothing for empty URLs', () => {
      const openSpy = spyOn(window, 'open');
      service.openUrl('');
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
