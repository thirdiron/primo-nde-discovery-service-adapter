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

  constructor(
    @Inject('MODULE_PARAMETERS') public moduleParameters: any,
    @Optional() private translate?: TranslateService,
    @Optional() private debugLog?: DebugLogService
  ) {
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
      institutionName: this.institutionName,
      moduleParameters: this.moduleParameters,
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'config.service.ts:constructor',
        message: 'ConfigService init (multicampus + key index)',
        data: {
          isMulticampusMode: this.isMulticampusMode,
          modeRaw: this.moduleParameters?.mode ?? null,
          keyCount: Object.keys(this.moduleParameters ?? {}).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
  }

  private resolveInstitutionName(): string | null {
    const key = 'LibKey.institutionName';
    try {
      const value = this.translate?.instant ? this.translate.instant(key) : null;
      const normalized = typeof value === 'string' ? value.trim() : '';
      const resolved = normalized && normalized !== key ? normalized : null; // if the value is the same as the key, we didn't find a value (key not set in Alma)

      this.debugLog?.debug?.('ConfigService.resolveInstitutionName', {
        value: value,
        resolved,
      });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H3',
          location: 'config.service.ts:resolveInstitutionName',
          message: 'Resolve institutionName (multicampus)',
          data: {
            hasTranslate: !!this.translate,
            normalized: normalized || null,
            resolved: resolved || null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log

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
    // if not multicampus mode, return the config value with no prefix
    if (!this.isMulticampusMode) return this.moduleParameters?.[paramName];

    // Multicampus mode: always resolve `${institutionName}.${paramName}` (no fallback to unprefixed keys)
    if (!this.institutionName) {
      // Re-check on demand until translations are available.
      this.institutionName = this.resolveInstitutionName();
    }
    if (!this.institutionName) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H3',
          location: 'config.service.ts:getParam',
          message: 'getParam blocked: institutionName unresolved',
          data: { paramName },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
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
      return undefined;
    }
    const value = this.moduleParameters?.[actualKey];

    // #region agent log
    if (
      paramName === 'libraryId' ||
      paramName === 'viewOption' ||
      paramName === 'articleLinkEnabled' ||
      paramName === 'articlePDFDownloadLinkEnabled' ||
      paramName === 'journalCoverImagesEnabled'
    ) {
      fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H3',
          location: 'config.service.ts:getParam',
          message: 'getParam resolved prefixed key',
          data: {
            paramName,
            institutionName: this.institutionName,
            actualKey,
            valueType: typeof value,
            valuePreview:
              typeof value === 'string' ? value.slice(0, 20) : value === null ? null : undefined,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion agent log

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
