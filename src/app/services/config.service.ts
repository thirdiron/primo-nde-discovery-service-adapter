import { Injectable, Inject, Optional } from '@angular/core';
import { ViewOptionType } from '../shared/view-option.enum';
import { DebugLogService } from './debug-log.service';

/**
 * This Service is responsible for getting config values from the corresponding
 * configuration dataset associated with the account.
 */

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly isMulticampusMode: boolean;

  constructor(
    @Inject('MODULE_PARAMETERS') public moduleParameters: any,
    @Optional() private debugLog?: DebugLogService
  ) {
    const modeRaw = this.moduleParameters?.mode;
    this.isMulticampusMode = typeof modeRaw === 'string' && modeRaw.toLowerCase() === 'multicampus';

    // Debug-only: emit full MODULE_PARAMETERS for troubleshooting.
    this.debugLog?.debug?.('ConfigService.moduleParameters', {
      mode: this.isMulticampusMode ? 'multicampus' : 'single-campus',
      moduleParameters: this.moduleParameters,
    });
  }

  /**
   * Whether the add-on is configured to run in multicampus mode (config `mode` === 'multicampus').
   * In this mode, translation keys are looked up with a vid-derived prefix (see TranslationService).
   */
  isMulticampus(): boolean {
    return this.isMulticampusMode;
  }

  private getParam(paramName: string): any {
    return this.moduleParameters?.[paramName];
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

  showProblematicJournal(): boolean {
    return this.getBooleanParam('problematicJournalEnabled');
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
