import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  catchError,
  mergeMap,
  Observable,
  of,
  shareReplay,
  throwError,
  tap,
} from 'rxjs';
import { ApiResult, ArticleData, JournalData } from '../types/tiData.types';
import { ConfigService } from './config.service';
import { DebugLogService } from './debug-log.service';

// A 404 is a definitive "not in the TI API" answer (it drives the Unpaywall fallback), so it is
// cached like a success. Wrapped in a value because `shareReplay` re-subscribes after errors.
class CachedNotFound {
  constructor(readonly error: unknown) {}
}

/**
 * This Service is responsible for all HTTP requests and includes some
 * helper functions for processing the returned response, error handling
 * and type guard checks
 */
@Injectable({
  providedIn: 'root',
})
export class HttpService {
  static readonly MAX_CACHED_RESPONSES = 200;

  // Article/journal lookups keyed by identifier. The buttons and the journal cover both look up
  // the same record, and Primo re-creates our components on every list <-> detail navigation, so
  // without this each visit re-fetches every record twice.
  private readonly responseCache = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private debugLog: DebugLogService
  ) {}

  getArticle(doi: string): Observable<any> {
    return this.cached(`article:${doi}`, () => this.fetchArticle(doi));
  }

  getJournal(issn: string): Observable<any> {
    return this.cached(`journal:${issn}`, () => this.fetchJournal(issn));
  }

  private fetchArticle(doi: string): Observable<any> {
    const apiUrl = this.configService.getApiUrl();
    const endpoint = `${
      apiUrl
    }/articles/doi/${doi}?include=journal,library${this.appendAccessToken()}`;

    return this.http.get(endpoint, { observe: 'response' }).pipe(
      tap(res => {
        this.debugLog.debug('HttpService.getArticle.response', {
          doi,
          status: res?.status,
          statusText: res?.statusText,
          url: this.debugLog.redactUrlTokens(res?.url || endpoint),
          body: res?.body,
        });
      }),
      catchError(err => this.handleError(err, { op: 'getArticle', doi, endpoint }))
    );
  }

  private fetchJournal(issn: string): Observable<any> {
    const apiUrl = this.configService.getApiUrl();
    const endpoint = `${apiUrl}/search?issns=${issn}${this.appendAccessToken()}`;
    return this.http.get(endpoint, { observe: 'response' }).pipe(
      tap(res => {
        this.debugLog.debug('HttpService.getJournal.response', {
          issn,
          status: res?.status,
          statusText: res?.statusText,
          url: this.debugLog.redactUrlTokens(res?.url || endpoint),
          body: res?.body,
        });
      }),
      catchError(err => this.handleError(err, { op: 'getJournal', issn, endpoint }))
    );
  }

  getUnpaywall(doi: string): Observable<HttpResponse<Object>> {
    const email = this.configService.getEmailAddressKey();

    const endpoint = `https://api.unpaywall.org/v2/${doi}?email=${email}`;
    return this.http
      .get(endpoint, { observe: 'response' })
      .pipe(catchError(err => this.handleError(err)));
  }

  getData(response: ApiResult): ArticleData | JournalData | {} {
    let data = {};

    if (Array.isArray(response.body.data)) {
      data =
        response.body.data
          .filter(function (journal: any) {
            return journal?.browzineEnabled === true;
          })
          .pop() || [];
    } else {
      data = response.body.data;
    }

    return data;
  }

  getIncludedJournal(response: ApiResult): JournalData | null {
    let journal = null;

    if (response.body.included) {
      journal = Array.isArray(response.body.included)
        ? response.body.included[0]
        : response.body.included;
    }

    return journal;
  }

  // Type Guard functions
  // TypeScript docs: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
  isArticle(data: JournalData | ArticleData | {}): data is ArticleData {
    return (data as ArticleData).doi !== undefined;
  }
  isJournal(data: JournalData | ArticleData | {}): data is JournalData {
    return (data as JournalData).issn !== undefined;
  }

  // Concurrent and later callers share one request. Errors other than 404 are not cached:
  // `shareReplay` resets on error, so the next subscriber retries.
  private cached<T>(key: string, request: () => Observable<T>): Observable<T> {
    let shared$ = this.responseCache.get(key) as Observable<T | CachedNotFound> | undefined;
    if (shared$) {
      // Re-insert to mark as most recently used.
      this.responseCache.delete(key);
    } else {
      shared$ = request().pipe(
        catchError(err =>
          (err as { status?: number })?.status === 404
            ? of(new CachedNotFound(err))
            : throwError(() => err)
        ),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    this.responseCache.set(key, shared$);
    while (this.responseCache.size > HttpService.MAX_CACHED_RESPONSES) {
      this.responseCache.delete(this.responseCache.keys().next().value as string);
    }

    return shared$.pipe(
      mergeMap(value =>
        value instanceof CachedNotFound ? throwError(() => value.error) : of(value)
      )
    );
  }

  private appendAccessToken() {
    const apiKey = this.configService.getApiKey();
    return `&access_token=${apiKey}`;
  }

  private handleError(
    error: HttpErrorResponse,
    context?: {
      op?: 'getArticle' | 'getJournal' | 'getUnpaywall';
      doi?: string;
      issn?: string;
      endpoint?: string;
    }
  ) {
    const errorMessageRedacted =
      typeof error?.message === 'string' ? this.debugLog.redactUrlTokens(error.message) : undefined;
    this.debugLog.warn('HttpService.handleError', {
      op: context?.op,
      doi: context?.doi,
      issn: context?.issn,
      status: error?.status,
      statusText: error?.statusText,
      url: this.debugLog.redactUrlTokens(error?.url || context?.endpoint || ''),
      errorMessageRedacted,
    });

    // Return an observable with a user-facing error message.
    console.error(`Backend returned code ${error.status}, body was: `, error.error);

    // Preserve the HTTP status code for downstream error handlers (e.g., Unpaywall fallback on 404).
    const e: any = new Error(
      'Something bad in fetching data from the TI API happened; please try again later.'
    );
    e.status = error?.status;
    e.name = error?.name || e.name;
    return throwError(() => e);
  }
}
