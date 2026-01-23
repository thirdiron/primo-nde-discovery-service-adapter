import { Injectable, Inject, Optional } from '@angular/core';
import { ViewOptionType } from '../shared/view-option.enum';
import { TranslateService } from '@ngx-translate/core';
import { DebugLogService } from './debug-log.service';

/**
 * This Service is responsible for getting config values from the corresponding
 * configuration dataset associated with the account.
 */

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  // Case-insensitive config key lookup: maps lowercased config keys -> original key as stored in MODULE_PARAMETERS.
  // Used in multicampus mode to resolve `${institutionName}.${paramName}` even if casing differs.
  private readonly keyIndexLowerToActual: Map<string, string>;
  private readonly isMulticampusMode: boolean;
  private institutionName: string | null;
  private warnedMissingInstitutionName = false;
  private warnedInstitutionNameLookupError = false;
  private benchGetParamCount = 0;
  private readonly benchRunId = `cfg-bench-${Date.now()}`;

  constructor(
    @Inject('MODULE_PARAMETERS') public moduleParameters: any,
    @Optional() private translate?: TranslateService,
    @Optional() private debugLog?: DebugLogService
  ) {
    const benchCtorStart = this.nowMs();
    const keys = Object.keys(this.moduleParameters ?? {});
    this.keyIndexLowerToActual = new Map<string, string>();
    for (const k of keys) {
      if (typeof k !== 'string') continue;
      this.keyIndexLowerToActual.set(k.toLowerCase(), k);
    }

    const modeRaw = this.moduleParameters?.mode;
    this.isMulticampusMode = typeof modeRaw === 'string' && modeRaw.toLowerCase() === 'multicampus';
    // In multicampus mode, resolve the institution name lazily (translations may not be ready when the constructor here runs).
    this.institutionName = null;

    // Debug-only: emit full MODULE_PARAMETERS for troubleshooting.
    this.debugLog?.debug?.('ConfigService.moduleParameters', {
      mode: this.isMulticampusMode ? 'multicampus' : 'single-campus',
      institutionName: 'NOT YET SET',
      moduleParameters: this.moduleParameters,
    });

    // #region agent log TEMP-BENCH
    this.tempBenchLog('A', 'ctor: built moduleParameters key index', {
      runId: this.benchRunId,
      modeRaw: typeof modeRaw === 'string' ? modeRaw : null,
      isMulticampusMode: this.isMulticampusMode,
      keyCount: keys.length,
      elapsedMs: this.nowMs() - benchCtorStart,
    });
    // #endregion
  }

  private nowMs(): number {
    // Use performance.now when available (higher resolution in browsers), otherwise Date.now.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = (globalThis as any)?.performance;
      if (p && typeof p.now === 'function') return p.now();
    } catch {
      // ignore
    }
    return Date.now();
  }

  private tempBenchLog(hypothesisId: string, message: string, data: Record<string, unknown>) {
    // Marked TEMP-BENCH so we can safely remove after analysis.
    this.debugLog?.debug?.(`TEMP-BENCH ConfigService: ${message}`, data);
    // Send a copy to the session log collector (no secrets).
    // #region agent log TEMP-BENCH
    fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: this.benchRunId,
        hypothesisId,
        location: 'src/app/services/config.service.ts:tempBenchLog',
        message: `TEMP-BENCH ConfigService: ${message}`,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  private resolveInstitutionName(): string | null {
    const key = 'LibKey.institutionName';
    try {
      const benchStart = this.nowMs();
      const value = this.translate?.instant ? this.translate.instant(key) : null;
      const normalized = typeof value === 'string' ? value.trim() : '';
      const resolved = normalized && normalized !== key ? normalized : null; // if the value is the same as the key, we didn't find a value (key not set in Alma)

      // #region agent log TEMP-BENCH
      this.tempBenchLog('B', 'resolveInstitutionName', {
        runId: this.benchRunId,
        translateInstantAvailable: !!this.translate?.instant,
        resolved: !!resolved,
        resolvedLength: resolved ? resolved.length : 0,
        elapsedMs: this.nowMs() - benchStart,
      });
      // #endregion

      if (!resolved) {
        if (!this.warnedMissingInstitutionName) {
          this.warnedMissingInstitutionName = true;
          this.debugLog?.warn?.('ConfigService.multicampus.missingInstitutionName', {
            translationKey: key,
            resolvedValue: normalized || null,
          });
        }
      }
      return resolved;
    } catch (err) {
      if (!this.warnedInstitutionNameLookupError) {
        this.warnedInstitutionNameLookupError = true;
        this.debugLog?.warn?.('ConfigService.multicampus.institutionNameLookupError', {
          translationKey: key,
          error: this.debugLog?.safeError?.(err) ?? undefined,
        });
      }
      return null;
    }
  }

  private getParam(paramName: string): any {
    const benchStart = this.nowMs();
    this.benchGetParamCount += 1;
    // #region agent log TEMP-BENCH
    this.tempBenchLog('C', 'getParam: enter', {
      runId: this.benchRunId,
      count: this.benchGetParamCount,
      isMulticampusMode: this.isMulticampusMode,
      paramName,
      institutionNameCached: !!this.institutionName,
    });
    // #endregion

    // if not multicampus mode, return the config value with no prefix
    if (!this.isMulticampusMode) {
      const hasKey = this.moduleParameters ? Object.prototype.hasOwnProperty.call(this.moduleParameters, paramName) : false;
      const value = this.moduleParameters?.[paramName];
      // #region agent log TEMP-BENCH
      this.tempBenchLog('C', 'getParam: single-campus lookup complete', {
        runId: this.benchRunId,
        count: this.benchGetParamCount,
        paramName,
        hasKey,
        valueType: typeof value,
        elapsedMs: this.nowMs() - benchStart,
      });
      // #endregion
      return value;
    }

    // Multicampus mode: always resolve `${institutionName}.${paramName}` (no fallback to unprefixed keys)
    if (!this.institutionName) {
      // Re-check on demand until translations are available.
      const instStart = this.nowMs();
      this.institutionName = this.resolveInstitutionName();
      // #region agent log TEMP-BENCH
      this.tempBenchLog('D', 'getParam: institutionName lazy-resolve complete', {
        runId: this.benchRunId,
        count: this.benchGetParamCount,
        resolved: !!this.institutionName,
        resolvedLength: this.institutionName ? this.institutionName.length : 0,
        elapsedMs: this.nowMs() - instStart,
      });
      // #endregion
    }
    if (!this.institutionName) {
      // #region agent log TEMP-BENCH
      this.tempBenchLog('D', 'getParam: multicampus missing institutionName (return undefined)', {
        runId: this.benchRunId,
        count: this.benchGetParamCount,
        paramName,
        elapsedMs: this.nowMs() - benchStart,
      });
      // #endregion
      return undefined;
    }
    const lookupLower = `${this.institutionName}.${paramName}`.toLowerCase();
    const actualKey = this.keyIndexLowerToActual.get(lookupLower);
    if (!actualKey) {
      // Missing is treated as unset; optionally warn in debug mode for critical keys only.
      if (paramName === 'apiKey' || paramName === 'libraryId') {
        this.debugLog?.warn?.('ConfigService.multicampus.missingPrefixedKey', {
          paramName,
          institutionName: this.institutionName,
          expectedKeyLower: lookupLower,
        });
      }
      // #region agent log TEMP-BENCH
      this.tempBenchLog('C', 'getParam: multicampus key not found (return undefined)', {
        runId: this.benchRunId,
        count: this.benchGetParamCount,
        paramName,
        lookupLowerLength: lookupLower.length,
        elapsedMs: this.nowMs() - benchStart,
      });
      // #endregion
      return undefined;
    }
    const value = this.moduleParameters?.[actualKey];

    // #region agent log TEMP-BENCH
    this.tempBenchLog('C', 'getParam: multicampus lookup complete', {
      runId: this.benchRunId,
      count: this.benchGetParamCount,
      paramName,
      valueType: typeof value,
      elapsedMs: this.nowMs() - benchStart,
    });
    // #endregion

    return value;
  }

  private getBooleanParam(paramName: string): boolean {
    try {
      const parsedValue = JSON.parse(this.getParam(paramName));
      return parsedValue === true;
    } catch {
      return false;
    }
  }

  getIsUnpaywallEnabled(): boolean {
    return (
      this.getBooleanParam('articlePDFDownloadViaUnpaywallEnabled') ||
      this.getBooleanParam('articleLinkViaUnpaywallEnabled') ||
      this.getBooleanParam('articleAcceptedManuscriptPDFViaUnpaywallEnabled') ||
      this.getBooleanParam('articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled')
    );
  }
  showDirectToPDFLink(): boolean {
    return this.getBooleanParam('articlePDFDownloadLinkEnabled');
  }

  showArticleLink(): boolean {
    return this.getBooleanParam('articleLinkEnabled');
  }

  showFormatChoice(): boolean {
    return this.getBooleanParam('showFormatChoice');
  }

  showRetractionWatch(): boolean {
    return this.getBooleanParam('articleRetractionWatchEnabled');
  }

  showExpressionOfConcern(): boolean {
    return this.getBooleanParam('articleExpressionOfConcernEnabled');
  }

  showUnpaywallDirectToPDFLink(): boolean {
    return this.getBooleanParam('articlePDFDownloadViaUnpaywallEnabled');
  }

  showUnpaywallArticleLink(): boolean {
    return this.getBooleanParam('articleLinkViaUnpaywallEnabled');
  }

  showUnpaywallManuscriptPDFLink(): boolean {
    return this.getBooleanParam('articleAcceptedManuscriptPDFViaUnpaywallEnabled');
  }

  showUnpaywallManuscriptArticleLink(): boolean {
    return this.getBooleanParam('articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled');
  }

  showJournalBrowZineWebLinkText() {
    return this.getBooleanParam('journalBrowZineWebLinkTextEnabled');
  }

  showArticleBrowZineWebLinkText() {
    return this.getBooleanParam('articleBrowZineWebLinkTextEnabled');
  }

  showJournalCoverImages() {
    return this.getBooleanParam('journalCoverImagesEnabled');
  }

  showDocumentDeliveryFulfillment() {
    return this.getBooleanParam('documentDeliveryFulfillmentEnabled');
  }

  showLinkResolverLink() {
    return this.getBooleanParam('showLinkResolverLink');
  }

  enableLinkOptimizer() {
    return this.getBooleanParam('enableLinkOptimizer');
  }

  getApiUrl(): string {
    const libraryId = this.getParam('libraryId');
    return `https://public-api.thirdiron.com/public/v1/libraries/${libraryId}`;
  }

  getApiKey(): string {
    return this.getParam('apiKey');
  }

  getEmailAddressKey(): string {
    return this.getParam('unpaywallEmailAddressKey');
  }

  getViewOption(): ViewOptionType {
    const viewOption = this.getParam('viewOption');
    return Object.values(ViewOptionType).includes(viewOption)
      ? viewOption
      : ViewOptionType.StackPlusBrowzine;
  }
}
