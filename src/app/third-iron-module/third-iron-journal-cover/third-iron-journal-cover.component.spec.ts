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
            providers: [{ provide: JournalCoverService, useValue: mockJournalCoverService }],
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

  // This describe holds cases where a user navigates through fulldisplay records with the forward/backward buttons.
  // Here we simulate this navigation by swapping the searchResult object on the hostComponent.
  describe('navigation through fulldisplay records', () => {
    it('triggers hiding original Primo cover block and then restore of Primo cover block across host navigation when cover-present -> no-cover transition', async () => {
      const recordWithCover = {
        pnx: {
          control: { recordid: ['rec-with-cover'] },
          display: { type: ['journal'] },
          addata: { issn: ['1234-5678'] },
        },
      } as unknown as SearchEntity;

      const recordWithoutCover = {
        pnx: {
          control: { recordid: ['rec-without-cover'] },
          display: { type: ['journal'] },
          addata: { issn: ['9876-5432'] },
        },
      } as unknown as SearchEntity;

      const mockJournalCoverService = {
        getJournalCoverUrl: jasmine
          .createSpy('getJournalCoverUrl')
          .and.callFake((record: SearchEntity) => {
            const id = record?.pnx?.control?.recordid?.[0];
            return of(id === 'rec-with-cover' ? 'https://example.com/cover.jpg' : '');
          }),
      };

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronJournalCoverComponent],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            { provide: 'MODULE_PARAMETERS', useValue: MOCK_MODULE_PARAMETERS },
            { provide: Store, useValue: mockStore },
          ],
        })
        .overrideComponent(ThirdIronJournalCoverComponent, {
          set: {
            providers: [{ provide: JournalCoverService, useValue: mockJournalCoverService }],
          },
        })
        .compileComponents();

      httpTesting = TestBed.inject(HttpTestingController);

      fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
      component = fixture.componentInstance;
      component.hostComponent = { item: recordWithCover };

      const hideSpy = spyOn<any>(component, 'hidePrimoRecordImages').and.callThrough();
      const restoreSpy = spyOn<any>(component, 'restorePrimoRecordImages').and.callThrough();

      fixture.detectChanges();
      await fixture.whenStable();

      expect(hideSpy).toHaveBeenCalled();
      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(recordWithCover);

      component.hostComponent.item = recordWithoutCover;
      component.ngDoCheck();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockJournalCoverService.getJournalCoverUrl).toHaveBeenCalledWith(recordWithoutCover);
      expect(restoreSpy).toHaveBeenCalled();
    });
  });
});
