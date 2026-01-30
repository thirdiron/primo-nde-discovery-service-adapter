import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';

import { ThirdIronJournalCoverComponent } from './third-iron-journal-cover.component';
import { JournalCoverService } from '../../services/journal-cover.service';
import { SearchEntityService } from '../../services/search-entity.service';
import { SearchEntity } from '../../types/searchEntity.types';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';

describe('ThirdIronJournalCoverComponent', () => {
  let httpTesting: HttpTestingController;
  let journalCoverService: JournalCoverService;
  let searchEntityService: SearchEntityService;
  let component: ThirdIronJournalCoverComponent;
  let fixture: ComponentFixture<ThirdIronJournalCoverComponent>;
  let state$: BehaviorSubject<any>;
  const mockStore = {
    select: (projection: (state: any) => any) => state$.asObservable().pipe(map(projection)),
  } as unknown as Store<any>;

  const mockSearchEntity: SearchEntity = {
    pnx: {
      addata: {
        issn: ['1234-5678'],
      },
      display: {
        title: ['Test Journal'],
        type: ['journal'],
      },
      control: {
        recordid: ['test-record-1'],
      },
    },
  };

  beforeEach(async () => {
    state$ = new BehaviorSubject<any>({});
    await TestBed.configureTestingModule({
      imports: [ThirdIronJournalCoverComponent],
      providers: [
        JournalCoverService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: 'MODULE_PARAMETERS',
          useValue: MOCK_MODULE_PARAMETERS,
        },
        {
          provide: Store,
          useValue: mockStore,
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    journalCoverService = TestBed.inject(JournalCoverService);
    searchEntityService = TestBed.inject(SearchEntityService);

    fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('shouldEnhance behavior', () => {
    it('should call getJournalCoverUrl when shouldEnhanceCover is true, even if shouldEnhanceButtons is false', async () => {
      // Create mock services
      const mockSearchEntityService = {
        shouldEnhance: jasmine.createSpy('shouldEnhance').and.returnValue({
          shouldEnhanceCover: true,
          shouldEnhanceButtons: false,
        }),
        getEntityType: searchEntityService.getEntityType.bind(searchEntityService),
        getIssn: searchEntityService.getIssn.bind(searchEntityService),
        getDoi: searchEntityService.getDoi.bind(searchEntityService),
        isJournal: searchEntityService.isJournal.bind(searchEntityService),
        isArticle: searchEntityService.isArticle.bind(searchEntityService),
        isFiltered: searchEntityService.isFiltered.bind(searchEntityService),
      };

      const mockCoverUrl = 'https://example.com/journal-cover.jpg';
      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine.createSpy('getJournalCoverUrl').and.returnValue(of(mockCoverUrl)),
      };

      // Override component providers
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronJournalCoverComponent],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            {
              provide: 'MODULE_PARAMETERS',
              useValue: MOCK_MODULE_PARAMETERS,
            },
            {
              provide: Store,
              useValue: mockStore,
            },
          ],
        })
        .overrideComponent(ThirdIronJournalCoverComponent, {
          set: {
            providers: [
              { provide: SearchEntityService, useValue: mockSearchEntityService },
              { provide: JournalCoverService, useValue: mockJournalCoverService },
            ],
          },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;

      component.hostComponent = {
        item: mockSearchEntity,
      };

      fixture.detectChanges(); // runs ngOnInit
      component.ngDoCheck(); // Ensure proxy processes the record

      // Wait a bit for the observable to process
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that getJournalCoverUrl was called
      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(mockSearchEntity);
    });

    it('should NOT call getJournalCoverUrl when shouldEnhanceCover is false, even if shouldEnhanceButtons is true', async () => {
      // Create mock services
      const mockSearchEntityService = {
        shouldEnhance: jasmine.createSpy('shouldEnhance').and.returnValue({
          shouldEnhanceCover: false,
          shouldEnhanceButtons: true,
        }),
        getEntityType: searchEntityService.getEntityType.bind(searchEntityService),
        getIssn: searchEntityService.getIssn.bind(searchEntityService),
        getDoi: searchEntityService.getDoi.bind(searchEntityService),
        isJournal: searchEntityService.isJournal.bind(searchEntityService),
        isArticle: searchEntityService.isArticle.bind(searchEntityService),
        isFiltered: searchEntityService.isFiltered.bind(searchEntityService),
      };

      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine.createSpy('getJournalCoverUrl').and.returnValue(
          of('https://example.com/journal-cover.jpg')
        ),
      };

      // Override component providers
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronJournalCoverComponent],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            {
              provide: 'MODULE_PARAMETERS',
              useValue: MOCK_MODULE_PARAMETERS,
            },
            {
              provide: Store,
              useValue: mockStore,
            },
          ],
        })
        .overrideComponent(ThirdIronJournalCoverComponent, {
          set: {
            providers: [
              { provide: SearchEntityService, useValue: mockSearchEntityService },
              { provide: JournalCoverService, useValue: mockJournalCoverService },
            ],
          },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;

      component.hostComponent = {
        item: mockSearchEntity,
      };

      fixture.detectChanges(); // runs ngOnInit
      component.ngDoCheck(); // Ensure proxy processes the record

      // Wait a bit for the observable to process
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that getJournalCoverUrl was NOT called
      expect(mockJournalCoverService.getJournalCoverUrl).not.toHaveBeenCalled();
    });

    it('should NOT call getJournalCoverUrl when both shouldEnhanceCover and shouldEnhanceButtons are false', async () => {
      // Create mock services
      const mockSearchEntityService = {
        shouldEnhance: jasmine.createSpy('shouldEnhance').and.returnValue({
          shouldEnhanceCover: false,
          shouldEnhanceButtons: false,
        }),
        getEntityType: searchEntityService.getEntityType.bind(searchEntityService),
        getIssn: searchEntityService.getIssn.bind(searchEntityService),
        getDoi: searchEntityService.getDoi.bind(searchEntityService),
        isJournal: searchEntityService.isJournal.bind(searchEntityService),
        isArticle: searchEntityService.isArticle.bind(searchEntityService),
        isFiltered: searchEntityService.isFiltered.bind(searchEntityService),
      };

      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine.createSpy('getJournalCoverUrl').and.returnValue(
          of('https://example.com/journal-cover.jpg')
        ),
      };

      // Override component providers
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronJournalCoverComponent],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            {
              provide: 'MODULE_PARAMETERS',
              useValue: MOCK_MODULE_PARAMETERS,
            },
            {
              provide: Store,
              useValue: mockStore,
            },
          ],
        })
        .overrideComponent(ThirdIronJournalCoverComponent, {
          set: {
            providers: [
              { provide: SearchEntityService, useValue: mockSearchEntityService },
              { provide: JournalCoverService, useValue: mockJournalCoverService },
            ],
          },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;

      component.hostComponent = {
        item: mockSearchEntity,
      };

      fixture.detectChanges(); // runs ngOnInit
      component.ngDoCheck(); // Ensure proxy processes the record

      // Wait a bit for the observable to process
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that getJournalCoverUrl was NOT called
      expect(mockJournalCoverService.getJournalCoverUrl).not.toHaveBeenCalled();
    });

    it('should call getJournalCoverUrl when both shouldEnhanceCover and shouldEnhanceButtons are true', async () => {
      // Create mock services
      const mockSearchEntityService = {
        shouldEnhance: jasmine.createSpy('shouldEnhance').and.returnValue({
          shouldEnhanceCover: true,
          shouldEnhanceButtons: true,
        }),
        getEntityType: searchEntityService.getEntityType.bind(searchEntityService),
        getIssn: searchEntityService.getIssn.bind(searchEntityService),
        getDoi: searchEntityService.getDoi.bind(searchEntityService),
        isJournal: searchEntityService.isJournal.bind(searchEntityService),
        isArticle: searchEntityService.isArticle.bind(searchEntityService),
        isFiltered: searchEntityService.isFiltered.bind(searchEntityService),
      };

      const mockCoverUrl = 'https://example.com/journal-cover.jpg';
      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine.createSpy('getJournalCoverUrl').and.returnValue(of(mockCoverUrl)),
      };

      // Override component providers
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronJournalCoverComponent],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            {
              provide: 'MODULE_PARAMETERS',
              useValue: MOCK_MODULE_PARAMETERS,
            },
            {
              provide: Store,
              useValue: mockStore,
            },
          ],
        })
        .overrideComponent(ThirdIronJournalCoverComponent, {
          set: {
            providers: [
              { provide: SearchEntityService, useValue: mockSearchEntityService },
              { provide: JournalCoverService, useValue: mockJournalCoverService },
            ],
          },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;

      component.hostComponent = {
        item: mockSearchEntity,
      };

      fixture.detectChanges(); // runs ngOnInit
      component.ngDoCheck(); // Ensure proxy processes the record

      // Wait a bit for the observable to process
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that getJournalCoverUrl was called
      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(mockSearchEntity);
    });
  });
});
