// Response shape returned by `es6-3i-unpaywall`'s `getUnpaywallUrls()`
export interface UnpaywallUrls {
  title?: string;
  authors?: string;
  journalName?: string;

  articlePDFUrl?: string;
  articleLinkUrl?: string;
  manuscriptArticlePDFUrl?: string;
  manuscriptArticleLinkUrl?: string;

  /**
   * Comes from the upstream Unpaywall `best_oa_location.host_type`
   * (typically `publisher` or `repository`).
   */
  linkHostType?: string;
}
