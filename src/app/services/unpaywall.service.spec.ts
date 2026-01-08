import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

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

  describe('makeUnpaywallCall (doi decoding)', () => {
    it('should decode an encoded DOI before passing it to the Unpaywall library (prevents %2F -> %252F)', async () => {
      const encodedDoi = '10.1038%2Fs41467-021-26227-6';
      const expectedUnencodedDoi = '10.1038/s41467-021-26227-6';

      const getUnpaywallUrls = jasmine
        .createSpy('getUnpaywallUrls')
        .and.returnValue(Promise.resolve({} as UnpaywallUrls));

      // Ensure initUnpaywallClient() short-circuits and uses our spy client.
      (service as any).unpaywallClient = { getUnpaywallUrls };

      await firstValueFrom(
        service.makeUnpaywallCall(
          { status: 404, body: { data: {} } } as any,
          DEFAULT_DISPLAY_WATERFALL_RESPONSE,
          encodedDoi
        )
      );

      expect(getUnpaywallUrls).toHaveBeenCalledWith(expectedUnencodedDoi);
    });

    it('should pass through an already-unencoded DOI unchanged', async () => {
      const unencodedDoi = '10.1038/s41467-021-26227-6';

      const getUnpaywallUrls = jasmine
        .createSpy('getUnpaywallUrls')
        .and.returnValue(Promise.resolve({} as UnpaywallUrls));

      (service as any).unpaywallClient = { getUnpaywallUrls };

      await firstValueFrom(
        service.makeUnpaywallCall(
          { status: 404, body: { data: {} } } as any,
          DEFAULT_DISPLAY_WATERFALL_RESPONSE,
          unencodedDoi
        )
      );

      expect(getUnpaywallUrls).toHaveBeenCalledWith(unencodedDoi);
    });

    it('should fall back safely when DOI contains malformed percent-encoding', async () => {
      // decodeURIComponent('...%2G...') throws, so we should pass the original string through.
      const malformedEncodedDoi = '10.1038%2Gs41467-021-26227-6';

      const getUnpaywallUrls = jasmine
        .createSpy('getUnpaywallUrls')
        .and.returnValue(Promise.resolve({} as UnpaywallUrls));

      (service as any).unpaywallClient = { getUnpaywallUrls };

      await firstValueFrom(
        service.makeUnpaywallCall(
          { status: 404, body: { data: {} } } as any,
          DEFAULT_DISPLAY_WATERFALL_RESPONSE,
          malformedEncodedDoi
        )
      );

      expect(getUnpaywallUrls).toHaveBeenCalledWith(malformedEncodedDoi);
    });
  });

  describe('makeUnpaywallCall (preserves existing display info)', () => {
    it('should preserve Browzine button fields when Unpaywall returns a main URL', async () => {
      const doi = '10.1038%2Fs41467-021-26227-6';

      const getUnpaywallUrls = jasmine.createSpy('getUnpaywallUrls').and.returnValue(
        Promise.resolve({
          linkHostType: 'repository',
          articleLinkUrl: 'https://example.com/unpaywall-article',
        } as UnpaywallUrls)
      );

      // Ensure initUnpaywallClient() short-circuits and uses our spy client.
      (service as any).unpaywallClient = { getUnpaywallUrls };

      const displayInfoWithBrowzine = {
        ...DEFAULT_DISPLAY_WATERFALL_RESPONSE,
        entityType: EntityType.Article,
        browzineUrl: 'https://browzine.com/libraries/XXX/journals/123',
        showBrowzineButton: true,
      };

      const result = await firstValueFrom(
        service.makeUnpaywallCall(
          { status: 404, body: { data: {} } } as any,
          displayInfoWithBrowzine,
          doi
        )
      );

      expect(result.mainButtonType).toBe(ButtonType.UnpaywallArticleLink);
      expect(result.mainUrl).toBe('https://example.com/unpaywall-article');
      expect(result.browzineUrl).toBe(displayInfoWithBrowzine.browzineUrl);
      expect(result.showBrowzineButton).toBeTrue();
    });
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
