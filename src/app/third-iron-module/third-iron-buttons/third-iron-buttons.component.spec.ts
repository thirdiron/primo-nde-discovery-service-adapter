import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { ThirdIronButtonsComponent } from './third-iron-buttons.component';
import { SearchEntityService } from '../../services/search-entity.service';
import { ConfigService } from '../../services/config.service';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';
import { ButtonInfoService } from '../../services/button-info.service';
import { ViewOptionType } from 'src/app/shared/view-option.enum';
import { TranslateService } from '@ngx-translate/core';

describe('ThirdIronButtonsComponent', () => {
  // Minimal mock Store supporting select(projectionFn)
  let state$: BehaviorSubject<any>;
  const mockStore = {
    select: (projection: (state: any) => any) => state$.asObservable().pipe(map(projection)),
  } as unknown as Store<any>;

  beforeEach(async () => {
    state$ = new BehaviorSubject<any>({});

    await TestBed.configureTestingModule({
      imports: [ThirdIronButtonsComponent],
      providers: [
        ConfigService,
        { provide: Store, useValue: mockStore },
        { provide: 'MODULE_PARAMETERS', useValue: MOCK_MODULE_PARAMETERS },
        // Minimal stubs to satisfy DI; we don't execute enhance in this basic test
        { provide: SearchEntityService, useValue: { shouldEnhance: () => false } },
        {
          provide: TranslateService,
          useValue: {
            stream: (key: string) => of(key),
          },
        },
        {
          provide: ButtonInfoService,
          useValue: {
            getDisplayInfo: () => new BehaviorSubject(null).asObservable(),
            buildCombinedLinks: () => [],
            buildPrimoLinks: () => [],
          },
        },
      ],
    }).compileComponents();
  });

  it('should create component successfully', () => {
    const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('passes translated Primo labels into buildPrimoLinks and updates when translation streams emit', async () => {
    const html$ = new BehaviorSubject('Read Online');
    const pdf$ = new BehaviorSubject('Get PDF');
    const other$ = new BehaviorSubject('Other online options');
    const avail$ = new BehaviorSubject('Available Online');

    const translateMock = {
      stream: (key: string) => {
        switch (key) {
          case 'fulldisplay.HTML':
            return html$.asObservable();
          case 'fulldisplay.PDF':
            return pdf$.asObservable();
          case 'nde.delivery.code.otherOnlineOptions':
            return other$.asObservable();
          case 'delivery.code.fulltext':
            return avail$.asObservable();
          default:
            return of(key);
        }
      },
    } as Partial<TranslateService>;

    const viewModel$ = new BehaviorSubject<any>({
      onlineLinks: [{ type: 'PDF', url: 'https://example.com/pdf', source: 'primo' }],
      directLink: '/fulldisplay?docid=123',
      ariaLabel: '',
    });

    const buildPrimoLinksSpy = jasmine.createSpy('buildPrimoLinks').and.returnValue([]);
    const buttonInfoMock = {
      getDisplayInfo: () => of(null),
      buildCombinedLinks: () => [],
      buildPrimoLinks: buildPrimoLinksSpy,
    };

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ThirdIronButtonsComponent],
        providers: [
          ConfigService,
          { provide: Store, useValue: mockStore },
          { provide: 'MODULE_PARAMETERS', useValue: MOCK_MODULE_PARAMETERS },
          { provide: TranslateService, useValue: translateMock },
        ],
      })
      // ThirdIronButtonsComponent declares its own `providers: [SearchEntityService]`, so we must override it
      // to ensure `shouldEnhance()` is controllable in this test.
      .overrideProvider(SearchEntityService, { useValue: { shouldEnhance: () => true } })
      .overrideProvider(ButtonInfoService, { useValue: buttonInfoMock })
      .compileComponents();

    const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
    const component = fixture.componentInstance;
    component.viewOption = ViewOptionType.NoStack;

    component.hostComponent = {
      searchResult: { pnx: { control: { recordid: ['rec-1'] } } },
      viewModel$: viewModel$.asObservable(),
    };

    fixture.detectChanges(); // runs ngOnInit
    // Ensure the Rx pipeline runs by subscribing (in the real app the template async pipe does this).
    const sub = component.displayInfo$?.subscribe();
    await fixture.whenStable();

    expect(buildPrimoLinksSpy).toHaveBeenCalled();
    const firstArgs = buildPrimoLinksSpy.calls.mostRecent().args;
    expect(firstArgs[1]).toEqual({
      htmlText: 'Read Online',
      pdfText: 'Get PDF',
      otherOptions: 'Other online options',
      availableOnline: 'Available Online',
    });

    // Simulate language change by emitting new translated text
    pdf$.next('PDF (FR)');
    await fixture.whenStable();

    expect(buildPrimoLinksSpy.calls.count()).toBeGreaterThan(1);
    const lastArgs = buildPrimoLinksSpy.calls.mostRecent().args;
    expect(lastArgs[1]).toEqual({
      htmlText: 'Read Online',
      pdfText: 'PDF (FR)',
      otherOptions: 'Other online options',
      availableOnline: 'Available Online',
    });

    sub?.unsubscribe();
  });
});
