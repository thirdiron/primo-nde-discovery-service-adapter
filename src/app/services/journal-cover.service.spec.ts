import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JournalCoverService } from './journal-cover.service';
import { MOCK_MODULE_PARAMETERS } from './config.service.spec';
import { SearchEntity } from '../types/searchEntity.types';

describe('JournalCoverService', () => {
  let httpTesting: HttpTestingController;
  let service: JournalCoverService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        JournalCoverService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: 'MODULE_PARAMETERS',
          useValue: MOCK_MODULE_PARAMETERS,
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(JournalCoverService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('fetches a journal cover for an ISSN-only article (article without DOI but with ISSN)', () => {
    const entity = {
      pnx: {
        display: { type: ['article'] },
        addata: { issn: ['1234-5678'] },
      },
    } as unknown as SearchEntity;

    let actual = 'UNSET';
    service.getJournalCoverUrl(entity).subscribe(url => {
      actual = url;
    });

    // Should use the journal search endpoint (ISSN is normalized to "12345678")
    const req = httpTesting.expectOne(
      r => r.url.includes('/search') && r.url.includes('issns=12345678')
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      data: [
        {
          browzineEnabled: true,
          coverImageUrl: 'https://example.com/cover.jpg',
          id: 1,
          issn: '12345678',
          sjrValue: 0,
          title: 'Test Journal',
          type: 'journal',
        },
      ],
    });

    expect(actual).toBe('https://example.com/cover.jpg');
  });

  it('fetches an article by DOI and returns the included journal cover image', () => {
    const entity = {
      pnx: {
        display: { type: ['article'] },
        addata: { doi: ['10.1234/abc'] },
      },
    } as unknown as SearchEntity;

    let actual = 'UNSET';
    service.getJournalCoverUrl(entity).subscribe(url => {
      actual = url;
    });

    const req = httpTesting.expectOne(
      r => r.url.includes('/articles/doi/') && r.url.includes('10.1234%2Fabc')
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      data: {
        doi: '10.1234/abc',
      },
      included: [
        {
          issn: '12345678',
          coverImageUrl: 'https://example.com/article-journal-cover.jpg',
        },
      ],
    });

    expect(actual).toBe('https://example.com/article-journal-cover.jpg');
  });

  it('returns empty string and makes no HTTP calls when shouldEnhanceCover is false', () => {
    const entity = {
      pnx: {
        display: { type: ['article'] },
        addata: {},
      },
    } as unknown as SearchEntity;

    let actual = 'UNSET';
    service.getJournalCoverUrl(entity).subscribe(url => {
      actual = url;
    });

    httpTesting.expectNone(() => true);
    expect(actual).toBe('');
  });
});
