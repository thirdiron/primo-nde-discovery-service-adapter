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

  describe('shouldEnhanceCover behavior', () => {
    const setup = async ({
      enhanceCover,
      coverUrl = 'https://example.com/journal-cover.jpg',
    }: {
      enhanceCover: boolean;
      coverUrl?: string;
    }) => {
      const mockSearchEntityService = {
        shouldEnhanceCover: jasmine.createSpy('shouldEnhanceCover').and.returnValue(enhanceCover),
      };

      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine.createSpy('getJournalCoverUrl').and.returnValue(of(coverUrl)),
      };

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

      httpTesting = TestBed.inject(HttpTestingController);

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;
      component.hostComponent = { item: mockSearchEntity };

      fixture.detectChanges();
      component.ngDoCheck();
      fixture.detectChanges();
      await fixture.whenStable();

      return { mockSearchEntityService, mockJournalCoverService };
    };

    it('should call getJournalCoverUrl when shouldEnhanceCover is true', async () => {
      const { mockJournalCoverService } = await setup({
        enhanceCover: true,
      });

      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(mockSearchEntity);
    });

    it('should NOT call getJournalCoverUrl when shouldEnhanceCover is false', async () => {
      const { mockJournalCoverService } = await setup({
        enhanceCover: false,
      });

      expect(mockJournalCoverService.getJournalCoverUrl).not.toHaveBeenCalled();
    });
  });
});
