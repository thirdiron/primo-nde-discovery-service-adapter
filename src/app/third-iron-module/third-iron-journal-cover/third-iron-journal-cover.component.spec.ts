import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';

import { ThirdIronJournalCoverComponent } from './third-iron-journal-cover.component';
import { JournalCoverService } from '../../services/journal-cover.service';
import { SearchEntity } from '../../types/searchEntity.types';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';

describe('ThirdIronJournalCoverComponent', () => {
  let httpTesting: HttpTestingController;
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

    fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('journal cover service delegation', () => {
    const setup = async ({
      coverUrl = 'https://example.com/journal-cover.jpg',
    }: {
      coverUrl?: string;
    }) => {
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

      return { mockJournalCoverService };
    };

    it('calls getJournalCoverUrl for the current record', async () => {
      const { mockJournalCoverService } = await setup({});

      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(mockSearchEntity);
    });

    it('still delegates to getJournalCoverUrl when service returns empty cover', async () => {
      const { mockJournalCoverService } = await setup({
        coverUrl: '',
      });

      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(mockSearchEntity);
    });
  });
});
