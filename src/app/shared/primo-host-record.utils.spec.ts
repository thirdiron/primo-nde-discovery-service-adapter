import {
  resolvePrimoHostRecord,
  getPrimoHostRecordKey,
  getPrimoHostShape,
  getPrimoViewModelMeta,
} from './primo-host-record.utils';
import { SearchEntity } from '../types/searchEntity.types';

describe('primo-host-record.utils', () => {
  describe('resolvePrimoHostRecord', () => {
    it('returns null for null or undefined host', () => {
      expect(resolvePrimoHostRecord(null)).toBeNull();
      expect(resolvePrimoHostRecord(undefined)).toBeNull();
    });

    it('returns searchResult when present', () => {
      const record = { pnx: { addata: {}, display: { title: [], type: [] } } } as SearchEntity;
      const host = { searchResult: record };
      expect(resolvePrimoHostRecord(host)).toBe(record);
    });

    it('returns item when searchResult is absent', () => {
      const record = { pnx: { addata: {}, display: { title: [], type: [] } } } as SearchEntity;
      const host = { item: record };
      expect(resolvePrimoHostRecord(host)).toBe(record);
    });

    it('prefers searchResult over item when both exist', () => {
      const searchRecord = { pnx: { addata: {}, display: { title: ['A'], type: [] } } } as SearchEntity;
      const itemRecord = { pnx: { addata: {}, display: { title: ['B'], type: [] } } } as SearchEntity;
      const host = { searchResult: searchRecord, item: itemRecord };
      expect(resolvePrimoHostRecord(host)).toBe(searchRecord);
    });

    it('returns null when host has neither searchResult nor item', () => {
      expect(resolvePrimoHostRecord({})).toBeNull();
      expect(resolvePrimoHostRecord({ other: 'stuff' })).toBeNull();
    });
  });

  describe('getPrimoHostRecordKey', () => {
    it('returns null for null or undefined record', () => {
      expect(getPrimoHostRecordKey(null)).toBeNull();
      expect(getPrimoHostRecordKey(undefined)).toBeNull();
    });

    it('returns null for record without pnx', () => {
      expect(getPrimoHostRecordKey({} as SearchEntity)).toBeNull();
    });

    it('uses recordid when present', () => {
      const record = {
        pnx: {
          control: { recordid: ['rec123'] },
          addata: {},
          display: { title: [], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('rec123');
    });

    it('falls back to doi when recordid is absent', () => {
      const record = {
        pnx: {
          addata: { doi: ['10.1234/abc'] },
          display: { title: [], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('10.1234/abc');
    });

    it('falls back to issn when recordid and doi are absent', () => {
      const record = {
        pnx: {
          addata: { issn: ['1234-5678'] },
          display: { title: [], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('1234-5678');
    });

    it('falls back to eissn when recordid, doi, and issn are absent', () => {
      const record = {
        pnx: {
          addata: { eissn: ['8765-4321'] },
          display: { title: [], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('8765-4321');
    });

    it('falls back to title when no identifiers are present', () => {
      const record = {
        pnx: {
          addata: {},
          display: { title: ['Some Article Title'], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('Some Article Title');
    });

    it('respects fallback order: recordid wins over doi, issn, etc.', () => {
      const record = {
        pnx: {
          control: { recordid: ['rec999'] },
          addata: { doi: ['10.1234/abc'], issn: ['1234-5678'], eissn: ['8765-4321'] },
          display: { title: ['Title'], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBe('rec999');
    });

    it('returns null when all fallback fields are empty or absent', () => {
      const record = {
        pnx: {
          addata: {},
          display: { title: [], type: [] },
        },
      } as SearchEntity;
      expect(getPrimoHostRecordKey(record)).toBeNull();
    });
  });

  describe('getPrimoHostShape', () => {
    it('returns all false for null or undefined host', () => {
      expect(getPrimoHostShape(null)).toEqual({
        hasSearchResult: false,
        hasItem: false,
        hasViewModel$: false,
      });
      expect(getPrimoHostShape(undefined)).toEqual({
        hasSearchResult: false,
        hasItem: false,
        hasViewModel$: false,
      });
    });

    it('reflects presence of searchResult', () => {
      expect(getPrimoHostShape({ searchResult: {} })).toEqual({
        hasSearchResult: true,
        hasItem: false,
        hasViewModel$: false,
      });
    });

    it('reflects presence of item', () => {
      expect(getPrimoHostShape({ item: {} })).toEqual({
        hasSearchResult: false,
        hasItem: true,
        hasViewModel$: false,
      });
    });

    it('reflects presence of viewModel$', () => {
      const host = { viewModel$: { subscribe: () => {} } };
      expect(getPrimoHostShape(host)).toEqual({
        hasSearchResult: false,
        hasItem: false,
        hasViewModel$: true,
      });
    });

    it('reflects all fields when present', () => {
      const host = {
        searchResult: {},
        item: {},
        viewModel$: { subscribe: () => {} },
      };
      expect(getPrimoHostShape(host)).toEqual({
        hasSearchResult: true,
        hasItem: true,
        hasViewModel$: true,
      });
    });
  });

  describe('getPrimoViewModelMeta', () => {
    it('returns safe defaults for null or undefined viewModel', () => {
      expect(getPrimoViewModelMeta(null)).toEqual({
        directLink: null,
        onlineLinksCount: 0,
        hasConsolidatedCoverage: false,
      });
      expect(getPrimoViewModelMeta(undefined)).toEqual({
        directLink: null,
        onlineLinksCount: 0,
        hasConsolidatedCoverage: false,
      });
    });

    it('extracts directLink', () => {
      const result = getPrimoViewModelMeta({ directLink: 'https://example.com' } as any);
      expect(result['directLink']).toBe('https://example.com');
    });

    it('counts onlineLinks when array', () => {
      const vm = {
        onlineLinks: [{ url: 'a' }, { url: 'b' }],
      } as any;
      const result = getPrimoViewModelMeta(vm);
      expect(result['onlineLinksCount']).toBe(2);
    });

    it('returns onlineLinksCount 0 when onlineLinks is not an array', () => {
      expect(getPrimoViewModelMeta({ onlineLinks: null } as any)['onlineLinksCount']).toBe(0);
      expect(getPrimoViewModelMeta({ onlineLinks: undefined } as any)['onlineLinksCount']).toBe(0);
      expect(getPrimoViewModelMeta({ onlineLinks: 'string' } as any)['onlineLinksCount']).toBe(0);
    });

    it('reflects hasConsolidatedCoverage', () => {
      expect(
        getPrimoViewModelMeta({ consolidatedCoverage: 'Some coverage text' } as any)[
          'hasConsolidatedCoverage'
        ]
      ).toBe(true);
      expect(
        getPrimoViewModelMeta({ consolidatedCoverage: '' } as any)['hasConsolidatedCoverage']
      ).toBe(false);
    });
  });
});
