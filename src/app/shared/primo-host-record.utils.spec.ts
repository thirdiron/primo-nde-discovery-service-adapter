import {
  resolvePrimoHostRecord,
  getPrimoHostRecordKey,
  getPrimoHostShape,
  getPrimoViewModelMeta,
  getPrimoAvailabilityHostMeta,
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
      const searchRecord = {
        pnx: { addata: {}, display: { title: ['A'], type: [] } },
      } as SearchEntity;
      const itemRecord = {
        pnx: { addata: {}, display: { title: ['B'], type: [] } },
      } as SearchEntity;
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
        viewModelKeys: [],
      });
      expect(getPrimoViewModelMeta(undefined)).toEqual({
        directLink: null,
        onlineLinksCount: 0,
        hasConsolidatedCoverage: false,
        viewModelKeys: [],
      });
    });

    it('lists viewModel keys so renamed or removed fields show up in logs', () => {
      const vm = { onlineLinks: [], consolidatedCoverage: '', ariaLabel: 'x' } as any;
      expect(getPrimoViewModelMeta(vm)['viewModelKeys']).toEqual([
        'onlineLinks',
        'consolidatedCoverage',
        'ariaLabel',
      ]);
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

  describe('getPrimoAvailabilityHostMeta', () => {
    class FakeNewBuildHost {
      onlineAvailability = 'not_restricted';
      openLink = false;
      isFullDisplay = true;
      searchResult = {};
      delivery = () => ({
        deliveryCategory: ['Alma-E'],
        displayedAvailability: 'not_restricted',
        electronicServices: [{ hasAccess: false }, { hasAccess: true }],
      });
      onAvailabilityClicked() {}
      openDirectLink() {}
    }

    class FakeOldBuildHost {
      onlineAvailability = 'not_restricted';
      openLink = true;
      delivery = () => ({ deliveryCategory: ['Alma-E'], electronicServices: [] });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onAvailabilityClicked(_directLink: string) {}
    }

    it('reports no host for null, undefined, or non-object values', () => {
      expect(getPrimoAvailabilityHostMeta(null)).toEqual({ hasHost: false });
      expect(getPrimoAvailabilityHostMeta(undefined)).toEqual({ hasHost: false });
      expect(getPrimoAvailabilityHostMeta('host')).toEqual({ hasHost: false });
    });

    it('reports members and availability state of a new-build host', () => {
      const meta = getPrimoAvailabilityHostMeta(new FakeNewBuildHost());
      expect(meta['hasHost']).toBe(true);
      expect(meta['ownKeys']).toEqual(
        jasmine.arrayContaining(['onlineAvailability', 'openLink', 'delivery', 'searchResult'])
      );
      expect(meta['protoMethods']).toEqual(['onAvailabilityClicked', 'openDirectLink']);
      expect(meta['hasOnAvailabilityClicked']).toBe(true);
      expect(meta['onAvailabilityClickedArity']).toBe(0);
      expect(meta['typeofDelivery']).toBe('function');
      expect(meta['onlineAvailability']).toBe('not_restricted');
      expect(meta['openLink']).toBe(false);
      expect(meta['isFullDisplay']).toBe(true);
      expect(meta['delivery']).toEqual({
        deliveryCategory: ['Alma-E'],
        displayedAvailability: 'not_restricted',
        electronicServicesCount: 2,
        firstServiceHasAccess: false,
      });
    });

    // with the November 2026 Primo release, the onAvailabilityClicked function dropped its directLink argument
    // Here we test the pre-November 2026 behavior for clients that may still be using the directLink argument
    it('reports the click handler arity of an old-build host', () => {
      const meta = getPrimoAvailabilityHostMeta(new FakeOldBuildHost());
      expect(meta['onAvailabilityClickedArity']).toBe(1);
      expect(meta['typeofDelivery']).toBe('function');
      expect(meta['openLink']).toBe(true);
      expect(meta['delivery']).toEqual({
        deliveryCategory: ['Alma-E'],
        displayedAvailability: null,
        electronicServicesCount: 0,
        firstServiceHasAccess: null,
      });
    });

    // If Primo renames or removes these members (or hands us a different host component),
    // the debug log should report them as missing rather than throw.
    it('handles hosts without the click handler or delivery', () => {
      const meta = getPrimoAvailabilityHostMeta({ searchResult: {} });
      expect(meta['protoMethods']).toEqual([]);
      expect(meta['hasOnAvailabilityClicked']).toBe(false);
      expect(meta['onAvailabilityClickedArity']).toBeNull();
      expect(meta['onlineAvailability']).toBeNull();
      expect(meta['openLink']).toBeNull();
      expect(meta['delivery']).toBeNull();
    });

    it('does not throw when reading delivery throws', () => {
      const host = {
        delivery: () => {
          throw new Error('signal read failed');
        },
      };
      expect(getPrimoAvailabilityHostMeta(host)['delivery']).toBeNull();
    });
  });
});
