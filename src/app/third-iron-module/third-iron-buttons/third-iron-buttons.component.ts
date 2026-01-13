import { Component, ElementRef, Input, ViewEncapsulation, DestroyRef } from '@angular/core';
import {
  Observable,
  auditTime,
  combineLatest,
  distinctUntilChanged,
  defer,
  filter,
  finalize,
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
  viewOption = this.configService.getViewOption();
  hasThirdIronSourceItems = false;
  private readonly instanceId = Math.random().toString(36).slice(2, 8);
  private lastPrimoRemovalRecordId: string | null = null;

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
    this.debugLog.debug('ThirdIronButtons.instance.init', {
      instanceId: this.instanceId,
    });

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
    this.displayInfo$ = defer(() => {
      this.debugLog.debug('ThirdIronButtons.displayInfo$.subscribe', {
        instanceId: this.instanceId,
      });

      return hostRecord$.pipe(
        switchMap(record => {
          const recordId = record?.pnx?.control?.recordid?.[0] ?? null;
          this.debugLog.debug('ThirdIronButtons.ngOnInit.hostRecord', {
            ...this.debugLog.safeSearchEntityMeta(record),
            hasRecordId: !!recordId,
          });

          const shouldEnhance = this.searchEntityService.shouldEnhance(record);
          if (!shouldEnhance) {
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

          // The host `viewModel$` commonly emits multiple times as it stabilizes (online links can be built
          // incrementally). Coalesce bursts and ignore duplicates so we don't rebuild links / re-hide Primo
          // elements repeatedly.
          const viewModelStable$ = this.viewModel$.pipe(
            auditTime(0),
            distinctUntilChanged((a, b) => this.viewModelKey(a) === this.viewModelKey(b))
          );

          return combineLatest([
            this.buttonInfoService.getDisplayInfo(record),
            viewModelStable$,
            this.primoLinkLabels$.pipe(
              distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
            ),
          ]).pipe(
            map(([displayInfo, viewModel, primoLinkLabels]) => {
              // If the TI API / waterfall yields no TI-specific button(s), we should leave the host Primo UI
              // untouched and render nothing from this component.
              this.hasThirdIronSourceItems = this.hasThirdIronAdditions(displayInfo);
              if (!this.hasThirdIronSourceItems) {
                this.combinedLinks = [];
                this.primoLinks = [];
                return displayInfo;
              }

              if (this.viewOption !== ViewOptionType.NoStack) {
                // build custom stack options array for StackPlusBrowzine and SingleStack view options
                this.combinedLinks = this.buttonInfoService.buildCombinedLinks(
                  displayInfo,
                  viewModel,
                  primoLinkLabels
                );

                // remove Primo generated buttons/stack if we have a custom stack (with TI added items)
                const recordId = record?.pnx?.control?.recordid?.[0] ?? null;
                if (
                  this.combinedLinks.length > 0 &&
                  recordId &&
                  this.lastPrimoRemovalRecordId !== recordId
                ) {
                  const hostElem = this.elementRef.nativeElement; // this component's template element
                  const removedCount = this.removePrimoOnlineAvailability(hostElem);
                  // Only "lock" this record id once we actually found and hid something.
                  // If the host Primo element isn't in the DOM yet, we want a later emission to retry.
                  if (removedCount > 0) this.lastPrimoRemovalRecordId = recordId;
                  this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                    reason: 'combinedLinks>0',
                    removedCount,
                  });
                }
              } else if (this.viewOption === ViewOptionType.NoStack) {
                // Build array of Primo only links, filter based on TI config settings
                this.primoLinks = this.buttonInfoService.buildPrimoLinks(
                  viewModel,
                  primoLinkLabels
                );

                // remove Primo "Online Options" button or Primo's stack (quick links and direct link)
                // Will be replaced with our own primoLinks options
                const hostElem = this.elementRef.nativeElement; // this component's template element
                const recordId = record?.pnx?.control?.recordid?.[0] ?? null;
                if (recordId && this.lastPrimoRemovalRecordId !== recordId) {
                  const removedCount = this.removePrimoOnlineAvailability(hostElem);
                  // Only "lock" this record id once we actually found and hid something.
                  // If the host Primo element isn't in the DOM yet, we want a later emission to retry.
                  if (removedCount > 0) this.lastPrimoRemovalRecordId = recordId;
                  this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                    reason: 'NoStack',
                    removedCount,
                  });
                }
              }

              return displayInfo;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.debugLog.debug('ThirdIronButtons.displayInfo$.unsubscribe', {
            instanceId: this.instanceId,
          });
        })
      );
    }).pipe(
      // Defensive: if something causes multiple subscribers, share the work (and avoid duplicate HTTP calls).
      shareReplay({ bufferSize: 1, refCount: true })
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

  /**
   * Returns a stable, string "signature" for the parts of the host Primo viewModel that affect:
   * - which links we build (Primo onlineLinks + directLink)
   * - whether we need to re-render our button UI
   *
   * Why we need this:
   * - The host `viewModel$` often emits multiple times while it "settles" (links can be added/rewritten
   *   incrementally, and the host may emit new object references even when content is unchanged).
   * - We use this signature with `distinctUntilChanged()` to skip duplicate emissions and avoid
   *   rebuilding stacks / re-hiding the Primo element repeatedly for the same effective state.
   *
   * Note:
   * - This is not intended to be cryptographically unique; it's a best-effort equality key.
   */
  private viewModelKey(vm: PrimoViewModel | null | undefined): string {
    const onlineLinksKey = (vm?.onlineLinks ?? [])
      .map(l => `${l?.type ?? ''}:${l?.url ?? ''}:${l?.source ?? ''}`)
      .join('|');
    return [
      vm?.directLink ?? '',
      vm?.consolidatedCoverage ?? '',
      vm?.ariaLabel ?? '',
      onlineLinksKey,
    ].join('||');
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
