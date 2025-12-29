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
import { DebugLogService } from './debug-log.service';
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
    private httpService: HttpService,
    private debugLog: DebugLogService
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
      this.debugLog.warn('Unpaywall.makeUnpaywallCall.skip_client_not_ready', {
        doi,
        doiUnencoded,
        clientReady: false,
      });
      return of(displayInfo);
    }

    const data = this.httpService.getData(articleResponse);
    const avoidUnpaywallPublisherLinks = !!(
      this.httpService.isArticle(data) && data?.avoidUnpaywallPublisherLinks
    );

    this.debugLog.debug('Unpaywall.makeUnpaywallCall.start', {
      doi,
      doiUnencoded,
      clientReady: true,
      avoidUnpaywallPublisherLinks,
    });

    // `getUnpaywallUrls()` returns a Promise, so we wrap it with `defer(() => from(...))`
    // to convert it into an Observable that fits cleanly into this RxJS pipeline.
    return defer(() => {
      this.debugLog.debug('Unpaywall.getUnpaywallUrls.invoke', { doi, doiUnencoded });
      // IMPORTANT: the underlying library constructs the Unpaywall URL and (typically) URL-encodes
      // the DOI. Our upstream `SearchEntityService.getDoi()` returns an encoded DOI for TI API paths,
      // so we decode here to prevent double-encoding (%2F -> %252F).
      return from(this.unpaywallClient.getUnpaywallUrls(doiUnencoded) as Promise<UnpaywallUrls>);
    }).pipe(
      tap(unpaywallUrls => {
        this.debugLog.debug('Unpaywall.getUnpaywallUrls.result', {
          doi,
          doiUnencoded,
          articlePDFUrl: unpaywallUrls?.articlePDFUrl,
          articleLinkUrl: unpaywallUrls?.articleLinkUrl,
          manuscriptPDFUrl: unpaywallUrls?.manuscriptArticlePDFUrl,
          manuscriptLinkUrl: unpaywallUrls?.manuscriptArticleLinkUrl,
          linkHostType: unpaywallUrls?.linkHostType,
        });
      }),
      map(unpaywallUrls =>
        this.unpaywallUrlsToDisplayInfo(unpaywallUrls, avoidUnpaywallPublisherLinks)
      ),
      map(unpaywallButtonInfo => {
        const usedUnpaywall = !!(unpaywallButtonInfo.mainUrl && unpaywallButtonInfo.mainUrl !== '');

        this.debugLog.debug('Unpaywall.applyResult', {
          doi,
          avoidUnpaywallPublisherLinks,
          usedUnpaywall,
          unpaywallMainButtonType: (unpaywallButtonInfo as any)?.mainButtonType,
          originalMainButtonType: (displayInfo as any)?.mainButtonType,
        });

        if (usedUnpaywall) {
          return unpaywallButtonInfo;
        }
        return displayInfo;
      }),
      catchError(err => {
        this.debugLog.warn('Unpaywall.getUnpaywallUrls.error', {
          doi,
          doiUnencoded,
          err: this.debugLog.safeError(err),
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
      this.debugLog.warn('Unpaywall.initClient.noFetch', {});
      return;
    }

    // Adapter to let the es6-3i-unpaywall library use the browser fetch API
    const fetcher = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: (input: any, init?: any) => fetch(input, init),
    };

    const lib: any = UnpaywallLib as any;
    this.unpaywallClient = lib.Unpaywall ? new lib.Unpaywall(false, fetcher) : null;
    this.debugLog.debug('Unpaywall.initClient', {
      ready: !!this.unpaywallClient?.getUnpaywallUrls,
    });
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
