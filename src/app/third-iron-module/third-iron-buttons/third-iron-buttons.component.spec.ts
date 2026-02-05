import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { Component, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { By } from '@angular/platform-browser';

import { ThirdIronButtonsComponent } from './third-iron-buttons.component';
import { SearchEntityService } from '../../services/search-entity.service';
import { ConfigService } from '../../services/config.service';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';
import { ButtonInfoService } from '../../services/button-info.service';
import { ViewOptionType } from 'src/app/shared/view-option.enum';
import { TranslateService } from '@ngx-translate/core';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { ButtonType } from 'src/app/shared/button-type.enum';
import { DebugLogService } from 'src/app/services/debug-log.service';

@Component({
  selector: 'stacked-dropdown',
  standalone: true,
  template: '',
})
class StackedDropdownStubComponent {
  @Input() links: any[] = [];
}

@Component({
  selector: 'main-button',
  standalone: true,
  template: '',
})
class MainButtonStubComponent {
  @Input() url = '';
  @Input() buttonType: any;
}

@Component({
  selector: 'article-link-button',
  standalone: true,
  template: '',
})
class ArticleLinkButtonStubComponent {
  @Input() url = '';
}

@Component({
  selector: 'custom-browzine-button',
  standalone: true,
  template: '',
})
class BrowzineButtonStubComponent {
  @Input() entityType: any;
  @Input() url = '';
}

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

  describe('template rendering permutations', () => {
    beforeEach(async () => {
      // These tests focus on ThirdIronButtonsComponent's template branching / ordering.
      // We stub child components to keep tests focused on template branching / ordering.
      state$ = new BehaviorSubject<any>({});

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [ThirdIronButtonsComponent],
          providers: [
            ConfigService,
            { provide: Store, useValue: mockStore },
            { provide: 'MODULE_PARAMETERS', useValue: MOCK_MODULE_PARAMETERS },
            { provide: SearchEntityService, useValue: { shouldEnhance: () => false } },
            { provide: ButtonInfoService, useValue: {} },
            { provide: DebugLogService, useValue: { debug: () => {}, safeSearchEntityMeta: () => ({}) } },
            { provide: TranslateService, useValue: { stream: (key: string) => of(key) } },
          ],
        })
        .overrideComponent(ThirdIronButtonsComponent, {
          // Replace standalone imports to avoid instantiating child components.
          set: {
            imports: [
              AsyncPipe,
              StackedDropdownStubComponent,
              MainButtonStubComponent,
              ArticleLinkButtonStubComponent,
              BrowzineButtonStubComponent,
            ],
          },
        })
        .compileComponents();
    });

    const baseDisplayInfo = {
      entityType: EntityType.Article,
      mainButtonType: ButtonType.ArticleLink,
      mainUrl: 'https://example.com/article',
      showSecondaryButton: false,
      secondaryUrl: '',
      showBrowzineButton: false,
      browzineUrl: '',
    };

    const setupRender = async (opts?: {
      viewOption?: ViewOptionType;
      combinedLinks?: any[];
      primoLinks?: any[];
      hasThirdIronSourceItems?: boolean;
      displayInfo?: any;
      viewModel?: any;
    }) => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const configService = TestBed.inject(ConfigService);
      spyOn(configService, 'getViewOption').and.returnValue(
        opts?.viewOption ?? ViewOptionType.NoStack
      );
      component.combinedLinks = opts?.combinedLinks ?? [];
      component.primoLinks = opts?.primoLinks ?? [];
      component.hasThirdIronSourceItems = opts?.hasThirdIronSourceItems ?? true;

      // First pass runs the component's ngOnInit, which overwrites `displayInfo$` with the enhance pipeline.
      // We then replace the streams with our test values (we're testing template branching, not ngOnInit).
      fixture.detectChanges();

      component.viewModel$ = of(opts?.viewModel ?? {});
      component.displayInfo$ = of(opts?.displayInfo ?? baseDisplayInfo);

      fixture.detectChanges();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      return { fixture, component, el: fixture.nativeElement as HTMLElement };
    };

    // This is simulating the case where no links were found from the Third Iron API or the Add-On config is such that no buttons
    // for the found links should be shown. Here we test that if there are no Third Iron related links (hasThirdIronSourceItems === false),
    // then the add-on component renders nothing (original primo content is kept).
    it('renders nothing when hasThirdIronSourceItems is false (even if streams emit)', async () => {
      const { el } = await setupRender({
        hasThirdIronSourceItems: false,
        // Use realistic StackLink shapes (even though the template should render nothing in this case).
        combinedLinks: [
          {
            source: 'thirdIron',
            entityType: EntityType.Article,
            mainButtonType: ButtonType.ArticleLink,
            url: 'https://example.com',
            ariaLabel: '',
            label: '',
          },
        ],
        primoLinks: [
          {
            entityType: 'directLink',
            url: 'https://example.com',
            ariaLabel: '',
            source: 'directLink',
            label: 'Other online options',
          },
        ],
        displayInfo: {
          ...baseDisplayInfo,
          showBrowzineButton: true,
          browzineUrl: 'https://example.com/browzine',
        },
        viewModel: { consolidatedCoverage: '1999-2000' },
      });

      expect(el.querySelector('.ti-stack-options-container')).toBeNull();
      expect(el.querySelector('.ti-no-stack-container')).toBeNull();
      expect(el.querySelector('.ti-consolidated-coverage')).toBeNull();
    });

    describe('StackPlusBrowzine', () => {
      const baseStackPlusCombinedLinks = [
        {
          source: 'thirdIron',
          entityType: EntityType.Article,
          mainButtonType: ButtonType.ArticleLink,
          url: 'https://example.com/merged',
          ariaLabel: '',
          label: '',
        },
      ];

      const renderStackPlusBrowzine = async (opts?: { combinedLinks?: any[]; displayInfo?: any }) => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.StackPlusBrowzine,
          combinedLinks: opts?.combinedLinks ?? baseStackPlusCombinedLinks,
          displayInfo: opts?.displayInfo ?? baseDisplayInfo,
        });

        const container = el.querySelector('.ti-stack-options-container');
        expect(container).withContext(el.innerHTML).not.toBeNull();
        expect(container?.querySelectorAll('stacked-dropdown').length).toBe(1);

        return { el, container };
      };

      it('renders merged stack dropdown + Browzine button when both are present', async () => {
        const { container } = await renderStackPlusBrowzine({
          // Mirrors buildStackOptions()/buildCombinedLinks() output: TI + (optional) Primo links.
          combinedLinks: [
            ...baseStackPlusCombinedLinks,
            {
              entityType: 'directLink',
              url: '/fulldisplay?docid=123#nui.getit.service_viewit',
              ariaLabel: '',
              source: 'directLink',
              label: 'Other online options',
            },
          ],
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
        });

        const browzine = container?.querySelector('custom-browzine-button') as HTMLElement | null;
        expect(browzine).not.toBeNull();
        expect(browzine?.classList.contains('ti-browzine-button-with-stack')).toBeTrue();

        // assert that the browzine button is rendered after the stacked dropdown
        const ordered = Array.from(
          container?.querySelectorAll('stacked-dropdown, custom-browzine-button') ?? []
        );
        expect(ordered.map(n => n.tagName.toLowerCase())).toEqual([
          'stacked-dropdown',
          'custom-browzine-button',
        ]);
      });

      it('does not render Browzine button when showBrowzineButton is false (still shows dropdown)', async () => {
        const { container } = await renderStackPlusBrowzine({
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: false,
            browzineUrl: 'https://example.com/browzine',
          },
        });

        expect(container?.querySelector('custom-browzine-button')).toBeNull();
      });

      it('renders consolidated coverage next to the stack dropdown when present', async () => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.StackPlusBrowzine,
          combinedLinks: baseStackPlusCombinedLinks,
          primoLinks: [],
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
          viewModel: { consolidatedCoverage: 'Coverage: 2010 - present' },
        });

        const cov = el.querySelector('.ti-stack-options-container .ti-consolidated-coverage');
        expect(cov).withContext(el.innerHTML).not.toBeNull();
        expect(cov?.textContent ?? '').toContain('Coverage: 2010 - present');
      });

      it('BrowZine-only (combinedLinks empty): still renders consolidated coverage in the fallback buttons container', async () => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.StackPlusBrowzine,
          combinedLinks: [],
          primoLinks: [],
          displayInfo: {
            ...baseDisplayInfo,
            // No main/secondary; only BrowZine should render.
            mainUrl: '',
            mainButtonType: ButtonType.None,
            showSecondaryButton: false,
            secondaryUrl: '',
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
          viewModel: { consolidatedCoverage: 'Coverage: 2010 - present' },
        });

        const container = el.querySelector('.ti-no-stack-container');
        expect(container).withContext(el.innerHTML).not.toBeNull();
        expect(container?.querySelector('custom-browzine-button')).withContext(el.innerHTML).not.toBeNull();

        const cov = container?.querySelector('.ti-consolidated-coverage');
        expect(cov).withContext(el.innerHTML).not.toBeNull();
        expect(cov?.textContent ?? '').toContain('Coverage: 2010 - present');
      });
    });

    describe('SingleStack', () => {
      it('renders merged stack dropdown, and never renders the individual Browzine button (BrowZine is rendered as a link inside the stack dropdown)', async () => {
        const { fixture, el } = await setupRender({
          viewOption: ViewOptionType.SingleStack,
          // In SingleStack, any BrowZine entry should be represented as a link inside the single dropdown,
          // rather than rendering a separate <custom-browzine-button>.
          combinedLinks: [
            // Mirrors the shape produced by ButtonInfoService.buildCombinedLinks() for TI main button.
            {
              source: 'thirdIron',
              entityType: EntityType.Article,
              mainButtonType: ButtonType.ArticleLink,
              url: 'https://example.com/merged',
              ariaLabel: '',
              label: '',
            },
            // Mirrors the shape produced by ButtonInfoService.buildCombinedLinks() for SingleStack BrowZine.
            {
              source: 'thirdIron',
              entityType: EntityType.Article,
              mainButtonType: ButtonType.Browzine,
              url: 'https://example.com/browzine',
            },
          ],
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
        });

        const container = el.querySelector('.ti-stack-options-container');
        expect(container).withContext(el.innerHTML).not.toBeNull();

        expect(container?.querySelectorAll('stacked-dropdown').length).toBe(1);
        expect(container?.querySelector('custom-browzine-button')).toBeNull(); // individual Browzine button is not rendered

        // Verify the BrowZine entry is passed into the stacked dropdown's [links] input.
        const dropdownDe = fixture.debugElement.query(By.directive(StackedDropdownStubComponent));
        expect(dropdownDe).withContext(el.innerHTML).not.toBeNull();

        const dropdownCmp = dropdownDe.componentInstance as StackedDropdownStubComponent;
        expect(Array.isArray(dropdownCmp.links)).toBeTrue();
        expect(dropdownCmp.links.length).toBe(2);
        expect(dropdownCmp.links.some(l => l?.url === 'https://example.com/browzine')).toBeTrue();
        expect(dropdownCmp.links.some(l => l?.mainButtonType === ButtonType.Browzine)).toBeTrue();
      });

      it('renders consolidated coverage next to the stack dropdown when present', async () => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.SingleStack,
          combinedLinks: [
            {
              source: 'thirdIron',
              entityType: EntityType.Article,
              mainButtonType: ButtonType.ArticleLink,
              url: 'https://example.com/merged',
              ariaLabel: '',
              label: '',
            },
          ],
          primoLinks: [],
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: false,
            browzineUrl: '',
          },
          viewModel: { consolidatedCoverage: 'Coverage: 2010 - present' },
        });

        const cov = el.querySelector('.ti-stack-options-container .ti-consolidated-coverage');
        expect(cov).withContext(el.innerHTML).not.toBeNull();
        expect(cov?.textContent ?? '').toContain('Coverage: 2010 - present');
      });
    });

    describe('NoStack', () => {
      it('renders main + secondary + Primo dropdown + Browzine, with Primo dropdown before Browzine (ordering regression test)', async () => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.NoStack,
          combinedLinks: [],
          primoLinks: [
            // Mirrors buildPrimoLinks()/buildStackOptions() output: Primo online links are StackLink[].
            {
              entityType: 'HTML',
              url: 'https://example.com/ro',
              ariaLabel: '',
              source: 'quicklink',
              label: 'Read Online',
            },
            {
              entityType: 'PDF',
              url: 'https://example.com/pdf',
              ariaLabel: '',
              source: 'quicklink',
              label: 'Get PDF',
            },
          ],
          displayInfo: {
            ...baseDisplayInfo,
            mainUrl: 'https://example.com/article',
            showSecondaryButton: true,
            secondaryUrl: 'https://example.com/secondary',
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
        });

        const container = el.querySelector('.ti-no-stack-container');
        expect(container).withContext(el.innerHTML).not.toBeNull();

        expect(container?.querySelectorAll('main-button').length).toBe(1); // Third Iron main button
        expect(container?.querySelectorAll('article-link-button').length).toBe(1); // Third Iron secondary button
        expect(container?.querySelectorAll('stacked-dropdown').length).toBe(1); // for Primo links
        expect(container?.querySelectorAll('custom-browzine-button').length).toBe(1); // individual Browzine button

        const ordered = Array.from(
          container?.querySelectorAll(
            'main-button, article-link-button, stacked-dropdown, custom-browzine-button'
          ) ?? []
        );

        // assert that the buttons are rendered in the correct order:
        // Third Iron main button, Third Iron secondary button, Primo links, individual Browzine button
        expect(ordered.map(n => n.tagName.toLowerCase())).toEqual([
          'main-button',
          'article-link-button',
          'stacked-dropdown',
          'custom-browzine-button',
        ]);
      });

      it('does not render Primo dropdown when primoLinks is empty', async () => {
        const { el } = await setupRender({
          viewOption: ViewOptionType.NoStack,
          combinedLinks: [],
          primoLinks: [],
          displayInfo: {
            ...baseDisplayInfo,
            showBrowzineButton: true,
            browzineUrl: 'https://example.com/browzine',
          },
        });

        const container = el.querySelector('.ti-no-stack-container');
        expect(container).withContext(el.innerHTML).not.toBeNull();

        expect(container?.querySelector('stacked-dropdown')).toBeNull();
        expect(container?.querySelector('custom-browzine-button')).not.toBeNull();
      });
    });

    it('renders consolidated coverage when present on the viewModel', async () => {
      const { el } = await setupRender({
        viewOption: ViewOptionType.NoStack,
        combinedLinks: [],
        primoLinks: [],
        viewModel: { consolidatedCoverage: 'Coverage: 2010 - present' },
      });

      const cov = el.querySelector('.ti-consolidated-coverage');
      expect(cov).withContext(el.innerHTML).not.toBeNull();
      expect(cov?.textContent ?? '').toContain('Coverage: 2010 - present');
    });
  });

  describe('hasThirdIronAdditions', () => {
    it('returns false for null displayInfo', () => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const hasThirdIronAdd = (component as any).hasThirdIronAdditions.bind(component) as (
        displayInfo: any
      ) => boolean;
      expect(hasThirdIronAdd(null)).toBe(false);
    });

    it('returns false when there are no TI additions (ButtonType.None / empty urls)', () => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const hasThirdIronAdd = (component as any).hasThirdIronAdditions.bind(component) as (
        displayInfo: any
      ) => boolean;

      expect(
        hasThirdIronAdd({
          entityType: EntityType.Unknown,
          mainButtonType: ButtonType.None,
          mainUrl: '',
          showSecondaryButton: false,
          secondaryUrl: '',
          showBrowzineButton: false,
          browzineUrl: '',
        })
      ).toBe(false);
    });

    it('returns true when a TI main button is present', () => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const hasThirdIronAdd = (component as any).hasThirdIronAdditions.bind(component) as (
        displayInfo: any
      ) => boolean;

      expect(
        hasThirdIronAdd({
          entityType: EntityType.Article,
          mainButtonType: ButtonType.ArticleLink,
          mainUrl: 'https://example.com/article',
          showSecondaryButton: false,
          secondaryUrl: '',
          showBrowzineButton: false,
          browzineUrl: '',
        })
      ).toBe(true);
    });

    it('returns true when a TI secondary button is present', () => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const hasThirdIronAdd = (component as any).hasThirdIronAdditions.bind(component) as (
        displayInfo: any
      ) => boolean;

      expect(
        hasThirdIronAdd({
          entityType: EntityType.Article,
          mainButtonType: ButtonType.DirectToPDF,
          mainUrl: 'https://example.com/pdf',
          showSecondaryButton: true,
          secondaryUrl: 'https://example.com/article',
          showBrowzineButton: false,
          browzineUrl: '',
        })
      ).toBe(true);
    });

    it('returns true when Browzine is present (even if no main button)', () => {
      const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
      const component = fixture.componentInstance;

      const hasThirdIronAdd = (component as any).hasThirdIronAdditions.bind(component) as (
        displayInfo: any
      ) => boolean;

      expect(
        hasThirdIronAdd({
          entityType: EntityType.Journal,
          mainButtonType: ButtonType.None,
          mainUrl: '',
          showSecondaryButton: false,
          secondaryUrl: '',
          showBrowzineButton: true,
          browzineUrl: 'https://example.com/browzine',
        })
      ).toBe(true);
    });
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
      // Ensure TI is considered "present" so the component builds Primo links (for the NoStack replacement UI)
      // and we can validate the translation stream behavior.
      getDisplayInfo: () =>
        of({
          entityType: EntityType.Article,
          mainButtonType: ButtonType.ArticleLink,
          mainUrl: 'https://example.com/article',
          showSecondaryButton: false,
          secondaryUrl: '',
          showBrowzineButton: false,
          browzineUrl: '',
        }),
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
