import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { HttpService } from './http.service';
import { MOCK_MODULE_PARAMETERS } from './config.service.spec';

describe('HttpService', () => {
  let httpTesting: HttpTestingController;
  let service: HttpService;

  const responseMeta = {
    ok: true,
    status: 200,
    url: 'https://public-api.thirdiron.com/public/v1/libraries/322/search',
    body: {
      data: [],
      included: [
        {
          id: 18126,
          type: 'journals',
          title: 'theBMJ',
          issn: '09598138',
          sjrValue: 2.567,
          coverImageUrl:
            'https://assets.thirdiron.com/images/covers/0959-8138.png',
          browzineEnabled: true,
          browzineWebLink:
            'https://develop.browzine.com/libraries/XXX/journals/18126',
        },
      ],
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: 'MODULE_PARAMETERS',
          useValue: MOCK_MODULE_PARAMETERS,
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HttpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('response caching', () => {
    const articleRequest = (doi: string) => (req: { urlWithParams: string }) =>
      req.urlWithParams.includes(`/articles/doi/${doi}?`);
    const journalRequest = (issn: string) => (req: { urlWithParams: string }) =>
      req.urlWithParams.includes(`/search?issns=${issn}`);

    beforeEach(() => {
      spyOn(console, 'error');
    });

    afterEach(() => {
      httpTesting.verify();
    });

    it('shares one in-flight article request between concurrent callers', () => {
      const results: any[] = [];
      service.getArticle('10.1/a').subscribe(res => results.push(res.body));
      service.getArticle('10.1/a').subscribe(res => results.push(res.body));

      httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

      expect(results).toEqual([responseMeta.body, responseMeta.body]);
    });

    it('reuses a completed article response without another request', () => {
      service.getArticle('10.1/a').subscribe();
      httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

      let body: any;
      service.getArticle('10.1/a').subscribe(res => (body = res.body));

      httpTesting.expectNone(articleRequest('10.1/a'));
      expect(body).toEqual(responseMeta.body);
    });

    it('keeps the request alive for later callers when the first caller unsubscribes', () => {
      const sub = service.getArticle('10.1/a').subscribe();
      const req = httpTesting.expectOne(articleRequest('10.1/a'));
      sub.unsubscribe();

      expect(req.cancelled).toBeFalse();
      req.flush(responseMeta.body);

      let body: any;
      service.getArticle('10.1/a').subscribe(res => (body = res.body));
      expect(body).toEqual(responseMeta.body);
    });

    it('requests different DOIs separately', () => {
      service.getArticle('10.1/a').subscribe();
      service.getArticle('10.1/b').subscribe();

      httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);
      httpTesting.expectOne(articleRequest('10.1/b')).flush(responseMeta.body);
    });

    it('caches journal responses by ISSN independently of articles', () => {
      service.getJournal('09598138').subscribe();
      httpTesting.expectOne(journalRequest('09598138')).flush(responseMeta.body);

      service.getJournal('09598138').subscribe();
      httpTesting.expectNone(journalRequest('09598138'));
    });

    it('caches a 404 and replays it as an error with the status preserved', () => {
      const statuses: number[] = [];
      service.getArticle('10.1/missing').subscribe({ error: err => statuses.push(err.status) });
      httpTesting
        .expectOne(articleRequest('10.1/missing'))
        .flush(null, { status: 404, statusText: 'Not Found' });

      service.getArticle('10.1/missing').subscribe({ error: err => statuses.push(err.status) });

      httpTesting.expectNone(articleRequest('10.1/missing'));
      expect(statuses).toEqual([404, 404]);
    });

    it('does not cache other errors, so the next call retries', () => {
      let status: number | undefined;
      service.getArticle('10.1/a').subscribe({ error: err => (status = err.status) });
      httpTesting
        .expectOne(articleRequest('10.1/a'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      expect(status).toBe(500);

      let body: any;
      service.getArticle('10.1/a').subscribe(res => (body = res.body));
      httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

      expect(body).toEqual(responseMeta.body);
    });

    describe('expiration', () => {
      const ttl = HttpService.CACHE_TTL_MS;
      const start = new Date('2026-01-01T00:00:00Z').getTime();
      let now: number;

      beforeEach(() => {
        now = start;
        spyOn(Date, 'now').and.callFake(() => now);
      });

      it('reuses a cached response just before the TTL', () => {
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

        now = start + ttl - 1;
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectNone(articleRequest('10.1/a'));
      });

      it('re-fetches once the TTL has elapsed', () => {
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

        now = start + ttl;
        let body: any;
        service.getArticle('10.1/a').subscribe(res => (body = res.body));
        httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);
        expect(body).toEqual(responseMeta.body);

        // The fresh response is cached again.
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectNone(articleRequest('10.1/a'));
      });

      it('does not extend the TTL when an entry is read', () => {
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);

        now = start + ttl - 1;
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectNone(articleRequest('10.1/a'));

        now = start + ttl;
        service.getArticle('10.1/a').subscribe();
        httpTesting.expectOne(articleRequest('10.1/a')).flush(responseMeta.body);
      });

      it('expires cached 404s so records added later are picked up', () => {
        service.getJournal('00000000').subscribe({ error: () => {} });
        httpTesting
          .expectOne(journalRequest('00000000'))
          .flush(null, { status: 404, statusText: 'Not Found' });

        now = start + ttl;
        let body: any;
        service.getJournal('00000000').subscribe(res => (body = res.body));
        httpTesting.expectOne(journalRequest('00000000')).flush(responseMeta.body);
        expect(body).toEqual(responseMeta.body);
      });
    });

    it('evicts the least recently used entry beyond the cap', () => {
      const max = HttpService.MAX_CACHED_RESPONSES;
      for (let i = 0; i < max; i++) {
        service.getArticle(`10.1/${i}`).subscribe();
        httpTesting.expectOne(articleRequest(`10.1/${i}`)).flush(responseMeta.body);
      }

      // Touch the oldest so it becomes most recently used, then push one more in.
      service.getArticle('10.1/0').subscribe();
      service.getArticle('10.1/new').subscribe();
      httpTesting.expectOne(articleRequest('10.1/new')).flush(responseMeta.body);

      service.getArticle('10.1/0').subscribe();
      httpTesting.expectNone(articleRequest('10.1/0'));

      service.getArticle('10.1/1').subscribe();
      httpTesting.expectOne(articleRequest('10.1/1')).flush(responseMeta.body);
    });
  });
});
