import type { ArticleData, JournalData } from '../../src/app/types/tiData.types';

// Third Iron API responses for an article record.
// Shape of GET /public/v1/libraries/{id}/articles/doi/{doi}?include=journal,library

export const ARTICLE: ArticleData = {
  id: 55134408,
  type: 'articles',
  title: 'E2E fixture article',
  date: '2015-05-12',
  doi: '10.1002/ijc.25451',
  authors: 'Fixture, A.',
  inPress: false,
  openAccess: false,
  availableThroughBrowzine: true,
  unpaywallUsable: false,
  bestIntegratorLink: '',
  browzineWebLink: 'https://browzine.com/libraries/222/journals/10292/issues/1',
  fullTextFile: 'https://e2e.example.org/full-text.pdf',
  contentLocation: 'https://e2e.example.org/article',
};

export const JOURNAL: JournalData = {
  id: 10292,
  type: 'journals',
  title: 'E2E Fixture Journal',
  issn: '00284793',
  coverImageUrl: 'https://assets.thirdiron.com/default-journal-cover.png',
  browzineEnabled: true,
  browzineWebLink: 'https://browzine.com/libraries/222/journals/10292',
  sjrValue: 1.1,
};

/** Builds an article response, optionally changing fields, e.g. `{ retractionNoticeUrl: '…' }`. */
export function articleResponse(overrides: Partial<ArticleData> = {}) {
  return { data: { ...ARTICLE, ...overrides }, included: [JOURNAL] };
}
