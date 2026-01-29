import { Component, ElementRef, Input, ViewEncapsulation, DestroyRef } from '@angular/core';
import {
  Observable,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { BrowzineButtonComponent } from '../../components/browzine-button/browzine-button.component';
import { SearchEntity } from '../../types/searchEntity.types';
import { DisplayWaterfallResponse } from '../../types/displayWaterfallResponse.types';
import { SearchEntityService } from '../../services/search-entity.service';
import { ButtonInfoService } from '../../services/button-info.service';
import { ConfigService } from 'src/app/services/config.service';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleLinkButtonComponent } from 'src/app/components/article-link-button/article-link-button.component';
import { MainButtonComponent } from 'src/app/components/main-button/main-button.component';
import { StackLink, PrimoViewModel } from 'src/app/types/primoViewModel.types';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ViewOptionType } from 'src/app/shared/view-option.enum';
import { ButtonType } from 'src/app/shared/button-type.enum';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { StackedDropdownComponent } from 'src/app/components/stacked-dropdown/stacked-dropdown.component';
import { DebugLogService } from 'src/app/services/debug-log.service';
import { HostComponentProxy } from 'src/app/shared/host-component-proxy';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'custom-third-iron-buttons',
  standalone: true,
  imports: [
    MainButtonComponent,
    BrowzineButtonComponent,
    ArticleLinkButtonComponent,
    AsyncPipe,
    StackedDropdownComponent,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './third-iron-buttons.component.html',
  styleUrls: [
    './third-iron-buttons.component.scss',
    '../../components/stacked-dropdown/stacked-dropdown.component.scss',
  ],
  providers: [SearchEntityService],
  encapsulation: ViewEncapsulation.None,
})
export class ThirdIronButtonsComponent {
  // **Host record + viewModel proxy**:
  // The host can mutate `hostComponent` in-place and may also swap the `viewModel$` observable over time.
  // HostComponentProxy turns that mutable input into stable streams:
  // - record$: emits when record-id changes
  // - viewModel$: emits latest PrimoViewModel; auto-rebinds if the host swaps the observable reference
  private readonly hostProxy = new HostComponentProxy<SearchEntity, PrimoViewModel>({
    getRecord: host => (host?.searchResult as SearchEntity) ?? null,
    getRecordId: record => record?.pnx?.control?.recordid?.[0] ?? null,
    getViewModel$: host => (host?.viewModel$ as Observable<PrimoViewModel>) ?? null,
  });

  /**
   * Backing field for the `@Input() hostComponent` setter/getter.
   * We use a setter so we can run side-effects (push latest record + (re)bind viewModel$) whenever the
   * host updates the input.
   */
  private _hostComponent!: any;

  // Setup setter/getter so we can react when the host updates the input.
  @Input()
  set hostComponent(value: any) {
    this._hostComponent = value;
    this.hostProxy.setHostComponent(value);
  }
  get hostComponent(): any {
    return this._hostComponent;
  }
  elementRef: ElementRef;
  combinedLinks: StackLink[] = []; // used to build custom merged array of online services for stack views
  primoLinks: StackLink[] = []; // used to build array of Primo only links for NoStack view option
  showDropdown = false;
  get viewOption(): ViewOptionType {
    // Resolve lazily so multicampus config can “start working” once translations become available.
    return this.configService.getViewOption();
  }
  hasThirdIronSourceItems = false;

  // Expose enum to template
  ViewOptionType = ViewOptionType;

  displayInfo$!: Observable<DisplayWaterfallResponse | null>;

  // Exposed to template (async pipe) and used for link building.
  // This comes from HostComponentProxy so downstream always sees the latest PrimoViewModel, even if
  // the host swaps the observable instance or mutates without re-setting the @Input.
  viewModel$: Observable<PrimoViewModel> = this.hostProxy.viewModel$;

  // Emits the translated Primo label strings used when building Primo links (HTML/PDF + direct-link labels).
  // Because it uses `translate.stream(...)` under the hood, it re-emits on language changes; `shareReplay(1)`
  // ensures the latest values are reused across subscribers without redoing the translation work.
  private readonly primoLinkLabels$ = combineLatest([
    this.translationService.getTranslatedText$('fulldisplay.HTML', 'Read Online'),
    this.translationService.getTranslatedText$('fulldisplay.PDF', 'Get PDF'),
    this.translationService.getTranslatedText$(
      'nde.delivery.code.otherOnlineOptions',
      'Other online options'
    ),
    this.translationService.getTranslatedText$('delivery.code.fulltext', 'Available Online'),
  ]).pipe(
    map(([htmlText, pdfText, otherOptions, availableOnline]) => ({
      htmlText,
      pdfText,
      otherOptions,
      availableOnline,
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private buttonInfoService: ButtonInfoService,
    private searchEntityService: SearchEntityService,
    private configService: ConfigService,
    private debugLog: DebugLogService,
    private translationService: TranslationService,
    private destroyRef: DestroyRef,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  ngDoCheck() {
    // Some hosts mutate properties in-place rather than replacing the hostComponent object.
    // doCheck() detects those changes and keeps our proxy streams up to date.
    this.hostProxy.doCheck();
  }

  ngOnDestroy() {
    this.hostProxy.destroy();
  }

  ngOnInit() {
    const hostRecord$ = this.hostProxy.record$.pipe(
      filter((record): record is SearchEntity => !!record),
      distinctUntilChanged(
        (a, b) =>
          (a?.pnx?.control?.recordid?.[0] ?? null) === (b?.pnx?.control?.recordid?.[0] ?? null)
      )
    );

    // Drive displayInfo$ from a single pipeline keyed on the current host record.
    // Using switchMap cancels the previous record's inner stream immediately on record changes,
    // preventing "stale record + new viewModel" emissions that can overwrite our link state.
    this.displayInfo$ = hostRecord$.pipe(
      switchMap(record => {
        this.debugLog.debug(
          'ThirdIronButtons.ngOnInit.hostRecord',
          this.debugLog.safeSearchEntityMeta(record)
        );

        const { shouldEnhanceButtons } = this.searchEntityService.shouldEnhance(record);
        if (!shouldEnhanceButtons) {
          this.debugLog.debug(
            'ThirdIronButtons.enhance.skip',
            this.debugLog.safeSearchEntityMeta(record)
          );
          return of(null);
        }

        this.debugLog.debug('ThirdIronButtons.enhance.start', {
          viewOption: this.viewOption,
          ...this.debugLog.safeSearchEntityMeta(record),
        });

        return combineLatest([
          this.buttonInfoService.getDisplayInfo(record),
          this.viewModel$,
          this.primoLinkLabels$,
        ]).pipe(
          map(([displayInfo, viewModel, primoLinkLabels]) => {
            // Read once per emission; config may change (e.g. multicampus translations become available).
            const viewOption = this.viewOption;

            // If the TI API / waterfall yields no TI-specific button(s), we should leave the host Primo UI
            // untouched and render nothing from this component.
            this.hasThirdIronSourceItems = this.hasThirdIronAdditions(displayInfo);

            if (!this.hasThirdIronSourceItems) {
              this.combinedLinks = [];
              this.primoLinks = [];
              return displayInfo;
            }

            if (viewOption !== ViewOptionType.NoStack && shouldEnhanceButtons) {
              // build custom stack options array for StackPlusBrowzine and SingleStack view options
              // Clear stale NoStack links so template can't get "stuck" on old state.
              this.primoLinks = [];
              this.combinedLinks = this.buttonInfoService.buildCombinedLinks(
                displayInfo,
                viewModel,
                primoLinkLabels
              );

              this.debugLog.debug('ThirdIronButtons.combinedLinks', {
                combinedLinks: this.combinedLinks,
              });

              // remove Primo generated buttons/stack if we have a custom stack (with TI added items)
              if (this.combinedLinks.length > 0) {
                const hostElem = this.elementRef.nativeElement; // this component's template element
                const removedCount = this.removePrimoOnlineAvailability(hostElem);
                this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                  reason: 'combinedLinks>0',
                  removedCount,
                });
              }
            } else {
              // Build array of Primo only links, filter based on TI config settings
              // Clear stale stack links (viewOption can change during lifecycle in multicampus mode).
              this.combinedLinks = [];
              this.primoLinks = this.buttonInfoService.buildPrimoLinks(viewModel, primoLinkLabels);

              // remove Primo "Online Options" button or Primo's stack (quick links and direct link)
              // Will be replaced with our own primoLinks options
              const hostElem = this.elementRef.nativeElement; // this component's template element
              const removedCount = this.removePrimoOnlineAvailability(hostElem);
              this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                reason: 'NoStack',
                removedCount,
              });
            }

            return displayInfo;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  private hasThirdIronAdditions(displayInfo: DisplayWaterfallResponse | null): boolean {
    if (!displayInfo) return false;

    const hasThirdIronMainButton =
      displayInfo.entityType !== EntityType.Unknown &&
      displayInfo.mainButtonType !== ButtonType.None &&
      !!displayInfo.mainUrl;

    const hasThirdIronSecondaryButton =
      !!displayInfo.showSecondaryButton && !!displayInfo.secondaryUrl;

    // For StackPlusBrowzine, Browzine may be shown outside the stack, so it must count as "TI present".
    const hasThirdIronBrowzine = !!displayInfo.showBrowzineButton && !!displayInfo.browzineUrl;

    return hasThirdIronMainButton || hasThirdIronSecondaryButton || hasThirdIronBrowzine;
  }

  removePrimoOnlineAvailability = (hostElement: HTMLElement): number => {
    const blockParent = hostElement?.parentElement?.parentElement ?? null;
    if (!blockParent) {
      this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability.noAncestor', {
        hasParent: !!hostElement?.parentElement,
      });
      return 0;
    }

    const elems = blockParent.getElementsByTagName(
      'nde-online-availability'
    ) as HTMLCollectionOf<HTMLElement>;
    const arr = Array.from(elems);
    for (const elem of arr) {
      elem.style.display = 'none';
    }
    return arr.length;
  };
}
