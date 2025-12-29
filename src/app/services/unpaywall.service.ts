import { Injectable } from '@angular/core';
import { catchError, defer, from, map, Observable, of, tap } from 'rxjs';
import { ApiResult } from '../types/tiData.types';
import { EntityType } from '../shared/entity-type.enum';
import { ButtonType } from '../shared/button-type.enum';
import { DisplayWaterfallResponse } from '../types/displayWaterfallResponse.types';
import { ConfigService } from './config.service';
import { HttpService } from './http.service';
import { DEFAULT_DISPLAY_WATERFALL_RESPONSE } from '../shared/displayWaterfall.constants';
import { UnpaywallUrls } from '../types/unpaywall.types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - external library without TypeScript definitions
import * as UnpaywallLib from 'es6-3i-unpaywall';

/**
 * This Service is responsible for initiating the call to the Unpaywall endpoint
 * through the es6-3i-unpaywall library. The library will process the response to determine
 * what type of button we will display
 */
@Injectable({
  providedIn: 'root',
})
export class UnpaywallService {
  private unpaywallClient: any;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService
  ) {
    this.unpaywallClient = null;
  }

  makeUnpaywallCall(
    articleResponse: ApiResult,
    displayInfo: DisplayWaterfallResponse,
    doi: string
  ): Observable<DisplayWaterfallResponse> {
    this.initUnpaywallClient();

    const doiUnencoded = this.decodeDoiForUnpaywall(doi);

    if (!this.unpaywallClient?.getUnpaywallUrls) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'unpaywall.service.ts:makeUnpaywallCall',
          message: 'Unpaywall fallback SKIP (client not initialized)',
          data: { doi, clientReady: false },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion
      console.warn('[Unpaywall] client not initialized; skipping unpaywall fallback');
      return of(displayInfo);
    }

    const data = this.httpService.getData(articleResponse);
    const avoidUnpaywallPublisherLinks = !!(
      this.httpService.isArticle(data) && data?.avoidUnpaywallPublisherLinks
    );

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'unpaywall.service.ts:makeUnpaywallCall',
        message: 'Unpaywall fallback START (about to call library)',
        data: { doi, clientReady: true, avoidUnpaywallPublisherLinks },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'C',
      }),
    }).catch(() => {});
    // #endregion

    // `getUnpaywallUrls()` returns a Promise, so we wrap it with `defer(() => from(...))`
    // to convert it into an Observable that fits cleanly into this RxJS pipeline.
    return defer(() => {
      console.log('[Unpaywall] getUnpaywallUrls start', { doi });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'unpaywall.service.ts:makeUnpaywallCall:defer',
          message: 'Unpaywall library getUnpaywallUrls() invoked',
          data: { doi },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
      return from(this.unpaywallClient.getUnpaywallUrls(doiUnencoded) as Promise<UnpaywallUrls>);
    }).pipe(
      tap(unpaywallUrls => {
        console.log('[Unpaywall] getUnpaywallUrls result', { doi, unpaywallUrls });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'unpaywall.service.ts:makeUnpaywallCall:tap',
            message: 'Unpaywall library getUnpaywallUrls() result',
            data: { doi, unpaywallUrls },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
      }),
      map(unpaywallUrls =>
        this.unpaywallUrlsToDisplayInfo(unpaywallUrls, avoidUnpaywallPublisherLinks)
      ),
      map(unpaywallButtonInfo => {
        const usedUnpaywall = !!(unpaywallButtonInfo.mainUrl && unpaywallButtonInfo.mainUrl !== '');

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'unpaywall.service.ts:makeUnpaywallCall:map',
            message: 'Unpaywall mapped result applied?',
            data: {
              doi,
              avoidUnpaywallPublisherLinks,
              usedUnpaywall,
              unpaywallMainButtonType: (unpaywallButtonInfo as any)?.mainButtonType,
              unpaywallMainUrl: (unpaywallButtonInfo as any)?.mainUrl,
              originalMainButtonType: (displayInfo as any)?.mainButtonType,
              originalMainUrl: (displayInfo as any)?.mainUrl,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
        // #endregion

        if (usedUnpaywall) {
          return unpaywallButtonInfo;
        }
        return displayInfo;
      }),
      catchError(err => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'unpaywall.service.ts:makeUnpaywallCall:catchError',
            message: 'Unpaywall library call ERROR; returning original displayInfo',
            data: { doi, errName: err?.name, errMessage: err?.message },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'D',
          }),
        }).catch(() => {});
        // #endregion
        console.warn('[Unpaywall] getUnpaywallUrls error; falling back to original displayInfo', {
          doi,
          err,
        });
        return of(displayInfo);
      })
    );
  }

  private initUnpaywallClient(): void {
    if (this.unpaywallClient) {
      return;
    }

    // In some test environments `fetch` may not be available; fail gracefully.
    if (typeof fetch !== 'function') {
      this.unpaywallClient = null;
      return;
    }

    // Adapter to let the es6-3i-unpaywall library use the browser fetch API
    const fetcher = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: (input: any, init?: any) => fetch(input, init),
    };

    const lib: any = UnpaywallLib as any;
    this.unpaywallClient = lib.Unpaywall ? new lib.Unpaywall(false, fetcher) : null;
  }

  private unpaywallUrlsToDisplayInfo(
    unpaywallUrls: UnpaywallUrls,
    avoidUnpaywallPublisherLinks: boolean
  ): DisplayWaterfallResponse {
    if (avoidUnpaywallPublisherLinks && unpaywallUrls?.linkHostType === 'publisher') {
      return DEFAULT_DISPLAY_WATERFALL_RESPONSE;
    }

    const articlePDFUrl = unpaywallUrls?.articlePDFUrl || '';
    const articleLinkUrl = unpaywallUrls?.articleLinkUrl || '';
    const manuscriptPDFUrl = unpaywallUrls?.manuscriptArticlePDFUrl || '';
    const manuscriptLinkUrl = unpaywallUrls?.manuscriptArticleLinkUrl || '';

    let buttonType: ButtonType = ButtonType.None;
    let mainUrl = '';

    if (articlePDFUrl && this.configService.showUnpaywallDirectToPDFLink()) {
      buttonType = ButtonType.UnpaywallDirectToPDF;
      mainUrl = articlePDFUrl;
    } else if (articleLinkUrl && this.configService.showUnpaywallArticleLink()) {
      buttonType = ButtonType.UnpaywallArticleLink;
      mainUrl = articleLinkUrl;
    } else if (manuscriptPDFUrl && this.configService.showUnpaywallManuscriptPDFLink()) {
      buttonType = ButtonType.UnpaywallManuscriptPDF;
      mainUrl = manuscriptPDFUrl;
    } else if (manuscriptLinkUrl && this.configService.showUnpaywallManuscriptArticleLink()) {
      buttonType = ButtonType.UnpaywallManuscriptLink;
      mainUrl = manuscriptLinkUrl;
    }

    if (!mainUrl) {
      return DEFAULT_DISPLAY_WATERFALL_RESPONSE;
    }

    return {
      mainButtonType: buttonType,
      entityType: EntityType.Article,
      mainUrl,
    };
  }

  private decodeDoiForUnpaywall(input: string): string {
    const trimmed = (input ?? '').trim();
    try {
      // For the normal case: "10.1038%2F..." -> "10.1038/..."
      return decodeURIComponent(trimmed);
    } catch {
      // If input has malformed percent-encoding, fall back to original.
      return trimmed;
    }
  }
}
