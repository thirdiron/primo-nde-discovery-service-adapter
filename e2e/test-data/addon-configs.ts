// Add-on configs served to the add-on in place of the config.json uploaded to Alma.
//
// Each scenario is a complete config, so results never depend on what is currently uploaded
// for the view. Primo delivers every value as a string, flags included ("true", not true),
// so these do the same. See src/app/services/config.service.ts for what each key controls.

export type AddonConfig = Record<string, string>;

export const BASE_CONFIG: AddonConfig = {
  apiKey: 'e2e-test-key',
  libraryId: '222',
  viewOption: 'no-stack',
  articlePDFDownloadLinkEnabled: 'true',
  articleLinkEnabled: 'true',
  showFormatChoice: 'false',
  articleRetractionWatchEnabled: 'true',
  articleExpressionOfConcernEnabled: 'true',
  problematicJournalEnabled: 'true',
  journalBrowZineWebLinkTextEnabled: 'true',
  articleBrowZineWebLinkTextEnabled: 'true',
  journalCoverImagesEnabled: 'true',
  documentDeliveryFulfillmentEnabled: 'false',
  showLinkResolverLinkOnArticles: 'true',
  showLinkResolverLinkOnJournals: 'true',
  enableLinkOptimizer: 'false',
  printRecordsIntegrationEnabled: 'false',
  unpaywallEmailAddressKey: 'e2e@example.org',
  articlePDFDownloadViaUnpaywallEnabled: 'false',
  articleLinkViaUnpaywallEnabled: 'false',
  articleAcceptedManuscriptPDFViaUnpaywallEnabled: 'false',
  articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled: 'false',
};

export const SCENARIOS = {
  // "Read Article" only appears next to "Download PDF" when showFormatChoice is on.
  noStackWithFormatChoice: { ...BASE_CONFIG, showFormatChoice: 'true' },
  noStackPdfLinkDisabled: { ...BASE_CONFIG, articlePDFDownloadLinkEnabled: 'false' },
  noStackRetractionDisabled: { ...BASE_CONFIG, articleRetractionWatchEnabled: 'false' },
  stackPlusBrowzineBase: { ...BASE_CONFIG, viewOption: 'stack-plus-browzine' },
} satisfies Record<string, AddonConfig>;
