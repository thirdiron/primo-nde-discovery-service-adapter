import { TestBed } from '@angular/core/testing';

import { UnpaywallService } from './unpaywall.service';
import { MOCK_MODULE_PARAMETERS } from './config.service.spec';
import { ButtonType } from '../shared/button-type.enum';
import { EntityType } from '../shared/entity-type.enum';
import { HttpService } from './http.service';
import { DEFAULT_DISPLAY_WATERFALL_RESPONSE } from '../shared/displayWaterfall.constants';
import { UnpaywallUrls } from '../types/unpaywall.types';

describe('UnpaywallService', () => {
  let service: UnpaywallService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UnpaywallService,
        {
          provide: HttpService,
          useValue: {
            getData: () => ({}),
            isArticle: () => false,
          },
        },
        {
          provide: 'MODULE_PARAMETERS',
          useValue: MOCK_MODULE_PARAMETERS,
        },
      ],
    });
    service = TestBed.inject(UnpaywallService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('unpaywallUrlsToDisplayInfo (mapping)', () => {
    it('should return default response when avoiding publisher links and linkHostType is publisher', () => {
      const unpaywallUrls: UnpaywallUrls = {
        linkHostType: 'publisher',
        articlePDFUrl: 'https://publisher.com/article.pdf',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, true);
      expect(result).toEqual(DEFAULT_DISPLAY_WATERFALL_RESPONSE);
    });

    it('should prioritize Article PDF over Article Link when both are available', () => {
      const unpaywallUrls: UnpaywallUrls = {
        linkHostType: 'repository',
        articlePDFUrl: 'https://example.com/article.pdf',
        articleLinkUrl: 'https://example.com/article',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result.mainButtonType).toBe(ButtonType.UnpaywallDirectToPDF);
      expect(result.entityType).toBe(EntityType.Article);
      expect(result.mainUrl).toBe('https://example.com/article.pdf');
    });

    it('should return Article Link when PDF is not enabled but Article Link is enabled', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UnpaywallService,
          {
            provide: HttpService,
            useValue: {
              getData: () => ({}),
              isArticle: () => false,
            },
          },
          {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...MOCK_MODULE_PARAMETERS,
              articlePDFDownloadViaUnpaywallEnabled: false,
              articleLinkViaUnpaywallEnabled: true,
            },
          },
        ],
      });
      service = TestBed.inject(UnpaywallService);

      const unpaywallUrls: UnpaywallUrls = {
        articlePDFUrl: 'https://example.com/article.pdf',
        articleLinkUrl: 'https://example.com/article',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result.mainButtonType).toBe(ButtonType.UnpaywallArticleLink);
      expect(result.entityType).toBe(EntityType.Article);
      expect(result.mainUrl).toBe('https://example.com/article');
    });

    it('should return Manuscript PDF when enabled and present', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UnpaywallService,
          {
            provide: HttpService,
            useValue: {
              getData: () => ({}),
              isArticle: () => false,
            },
          },
          {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...MOCK_MODULE_PARAMETERS,
              articlePDFDownloadViaUnpaywallEnabled: false,
              articleLinkViaUnpaywallEnabled: false,
              articleAcceptedManuscriptPDFViaUnpaywallEnabled: true,
              articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled: true,
            },
          },
        ],
      });
      service = TestBed.inject(UnpaywallService);

      const unpaywallUrls: UnpaywallUrls = {
        manuscriptArticlePDFUrl: 'https://example.com/manuscript.pdf',
        manuscriptArticleLinkUrl: 'https://example.com/manuscript',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result.mainButtonType).toBe(ButtonType.UnpaywallManuscriptPDF);
      expect(result.entityType).toBe(EntityType.Article);
      expect(result.mainUrl).toBe('https://example.com/manuscript.pdf');
    });

    it('should return Manuscript Link when Manuscript PDF is disabled but Manuscript Article Link is enabled', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UnpaywallService,
          {
            provide: HttpService,
            useValue: {
              getData: () => ({}),
              isArticle: () => false,
            },
          },
          {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...MOCK_MODULE_PARAMETERS,
              articlePDFDownloadViaUnpaywallEnabled: false,
              articleLinkViaUnpaywallEnabled: false,
              articleAcceptedManuscriptPDFViaUnpaywallEnabled: false,
              articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled: true,
            },
          },
        ],
      });
      service = TestBed.inject(UnpaywallService);

      const unpaywallUrls: UnpaywallUrls = {
        manuscriptArticlePDFUrl: 'https://example.com/manuscript.pdf',
        manuscriptArticleLinkUrl: 'https://example.com/manuscript',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result.mainButtonType).toBe(ButtonType.UnpaywallManuscriptLink);
      expect(result.entityType).toBe(EntityType.Article);
      expect(result.mainUrl).toBe('https://example.com/manuscript');
    });

    it('should return Manuscript Link when only Manuscript Article Link is present and enabled', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UnpaywallService,
          {
            provide: HttpService,
            useValue: {
              getData: () => ({}),
              isArticle: () => false,
            },
          },
          {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...MOCK_MODULE_PARAMETERS,
              articlePDFDownloadViaUnpaywallEnabled: false,
              articleLinkViaUnpaywallEnabled: false,
              articleAcceptedManuscriptPDFViaUnpaywallEnabled: true,
              articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled: true,
            },
          },
        ],
      });
      service = TestBed.inject(UnpaywallService);

      const unpaywallUrls: UnpaywallUrls = {
        manuscriptArticleLinkUrl: 'https://example.com/manuscript',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result.mainButtonType).toBe(ButtonType.UnpaywallManuscriptLink);
      expect(result.entityType).toBe(EntityType.Article);
      expect(result.mainUrl).toBe('https://example.com/manuscript');
    });

    it('should return default response when all unpaywall options are disabled', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UnpaywallService,
          {
            provide: HttpService,
            useValue: {
              getData: () => ({}),
              isArticle: () => false,
            },
          },
          {
            provide: 'MODULE_PARAMETERS',
            useValue: {
              ...MOCK_MODULE_PARAMETERS,
              articlePDFDownloadViaUnpaywallEnabled: false,
              articleLinkViaUnpaywallEnabled: false,
              articleAcceptedManuscriptPDFViaUnpaywallEnabled: false,
              articleAcceptedManuscriptArticleLinkViaUnpaywallEnabled: false,
            },
          },
        ],
      });
      service = TestBed.inject(UnpaywallService);

      const unpaywallUrls: UnpaywallUrls = {
        articlePDFUrl: 'https://example.com/article.pdf',
        articleLinkUrl: 'https://example.com/article',
        manuscriptArticlePDFUrl: 'https://example.com/manuscript.pdf',
        manuscriptArticleLinkUrl: 'https://example.com/manuscript',
      };

      const result = (service as any).unpaywallUrlsToDisplayInfo(unpaywallUrls, false);
      expect(result).toEqual(DEFAULT_DISPLAY_WATERFALL_RESPONSE);
    });
  });
});
