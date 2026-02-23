import { TestBed } from '@angular/core/testing';

import { SearchEntityService } from './search-entity.service';
import { SearchEntity } from '../types/searchEntity.types';

describe('SearchEntityService', () => {
  let service: SearchEntityService;

  const makeEntity = ({
    type,
    issn,
    doi,
  }: {
    type: string;
    issn?: string[];
    doi?: string[];
  }): SearchEntity =>
    ({
      pnx: {
        display: {
          type: [type],
        },
        addata: {
          issn,
          doi,
        },
      },
    }) as unknown as SearchEntity;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchEntityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('shouldEnhanceCover', () => {
    it('returns true for an article with ISSN and no DOI', () => {
      const entity = makeEntity({ type: 'article', issn: ['1234-5678'] });
      expect(service.shouldEnhanceCover(entity)).toBe(true);
    });

    it('returns true for an article with a DOI (even if it has an ISSN)', () => {
      const entity = makeEntity({
        type: 'article',
        issn: ['1234-5678'],
        doi: ['10.1234/abc'],
      });
      expect(service.shouldEnhanceCover(entity)).toBe(true);
    });

    it('returns true for an article with a DOI and no ISSN', () => {
      const entity = makeEntity({
        type: 'article',
        doi: ['10.1234/abc'],
      });
      expect(service.shouldEnhanceCover(entity)).toBe(true);
    });

    it('returns true for an article without a DOI but with an ISSN', () => {
      const entity = makeEntity({
        type: 'article',
        issn: ['1234-5678'],
      });
      expect(service.shouldEnhanceCover(entity)).toBe(true);
    });

    it('returns false for an article with neither DOI nor ISSN', () => {
      const entity = makeEntity({ type: 'article' });
      expect(service.shouldEnhanceCover(entity)).toBe(false);
    });

    it('returns true for a journal with an ISSN', () => {
      const entity = makeEntity({ type: 'journal', issn: ['1234-5678'] });
      expect(service.shouldEnhanceCover(entity)).toBe(true);
    });

    it('returns false for a journal without an ISSN', () => {
      const entity = makeEntity({ type: 'journal' });
      expect(service.shouldEnhanceCover(entity)).toBe(false);
    });
  });

  describe('shouldEnhanceButtons', () => {
    it('returns false when the record is filtered (even if it would otherwise qualify)', () => {
      const entity = makeEntity({ type: 'journal', issn: ['1234-5678'] });
      spyOn(service, 'isFiltered').and.returnValue(true);
      expect(service.shouldEnhanceButtons(entity)).toBe(false);
    });

    it('returns true for a journal with an ISSN', () => {
      const entity = makeEntity({ type: 'journal', issn: ['1234-5678'] });
      expect(service.shouldEnhanceButtons(entity)).toBe(true);
    });

    it('returns true for an article with a DOI', () => {
      const entity = makeEntity({ type: 'article', doi: ['10.1234/abc'] });
      expect(service.shouldEnhanceButtons(entity)).toBe(true);
    });

    it('returns false for an article with only an ISSN (no DOI)', () => {
      const entity = makeEntity({ type: 'article', issn: ['1234-5678'] });
      expect(service.shouldEnhanceButtons(entity)).toBe(false);
    });

    it('returns false for a journal without an ISSN', () => {
      const entity = makeEntity({ type: 'journal' });
      expect(service.shouldEnhanceButtons(entity)).toBe(false);
    });
  });
});
