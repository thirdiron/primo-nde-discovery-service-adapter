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
import { ViewOptionType } from 'src/app/shared/view-option.enum';
import { ButtonType } from 'src/app/shared/button-type.enum';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { StackedDropdownComponent } from 'src/app/components/stacked-dropdown/stacked-dropdown.component';
import { DebugLogService } from 'src/app/services/debug-log.service';
import { HostComponentProxy } from 'src/app/shared/host-component-proxy';
import {
  getPrimoHostRecordKey,
  getPrimoHostShape,
  getPrimoViewModelMeta,
  resolvePrimoHostRecord,
} from 'src/app/shared/primo-host-record.utils';
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
  ],
  templateUrl: './third-iron-buttons.component.html',
  styleUrls: ['./third-iron-buttons.component.scss'],
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
    getRecord: host => resolvePrimoHostRecord(host),
    getRecordId: record => getPrimoHostRecordKey(record),
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
    const cycle = this.hostProxy.setHostComponent(value);
    this.debugLog.debug('ThirdIronButtons.hostProxy.setHostComponent', {
      cycle,
      hostShape: getPrimoHostShape(value),
      hostRecord: this.debugLog.safeSearchEntityMeta(resolvePrimoHostRecord(value)),
    });
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

  // **Render phase / anti-flash state**
  // The host (Primo) paints its native `nde-online-availability` buttons immediately, but our
  // enhancement decision depends on an async LibKey call. To avoid the "native buttons flash then
  // get replaced" effect, we hide the native buttons *eagerly* (as soon as we know a record is
  // enhance-eligible) and show a loading skeleton until the call settles.
  //  - 'idle'        : nothing decided yet (initial)
  //  - 'loading'     : eligible record, LibKey call in-flight; native buttons hidden, skeleton reserved
  //  - 'enhanced'    : LibKey settled with TI content; render our buttons
  //  - 'passthrough' : not eligible / no TI content; native Primo buttons shown, we render nothing
  buttonsPhase: 'idle' | 'loading' | 'enhanced' | 'passthrough' = 'idle';
  // Only becomes true once the skeleton-delay has elapsed, so fast/cached responses never flash a shimmer.
  showSkeleton = false;

  // Timing guards (ms). Kept as constants for easy tuning.
  private readonly SKELETON_DELAY_MS = 150; // don't show the shimmer for fast/cached responses
  private readonly SKELETON_MIN_VISIBLE_MS = 400; // once shown, keep it visible at least this long
  private readonly MAX_WAIT_MS = 8000; // fallback: restore native buttons if the call never settles

  private skeletonShownAt: number | null = null;
  private skeletonDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private enhanceCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  // Expose enum to template
  ViewOptionType = ViewOptionType;

  displayInfo$!: Observable<DisplayWaterfallResponse | null>;

  // Exposed to template (async pipe) and used for link building.
  // This comes from HostComponentProxy so downstream always sees the latest PrimoViewModel, even if
  // the host swaps the observable instance or mutates without re-setting the @Input.
  viewModel$: Observable<PrimoViewModel> = this.hostProxy.viewModel$;

  private readonly directLinkAriaLabel$ = this.viewModel$.pipe(
    map(viewModel => (viewModel?.ariaLabel ?? '').trim()),
    distinctUntilChanged(),
    switchMap(ariaLabel =>
      ariaLabel ? this.translationService.getTranslatedText$(ariaLabel, ariaLabel) : of('')
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Emits the translated Primo label strings used when building Primo links
  // (HTML/PDF + direct-link labels + direct-link aria-label).
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
    this.directLinkAriaLabel$,
  ]).pipe(
    map(([htmlText, pdfText, otherOptions, availableOnline, directLinkAriaLabel]) => ({
      htmlText,
      pdfText,
      otherOptions,
      availableOnline,
      directLinkAriaLabel,
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
    this.clearPhaseTimers();
    this.hostProxy.destroy();
  }

  ngOnInit() {
    const hostRecord$ = this.hostProxy.record$.pipe(
      filter((record): record is SearchEntity => !!record),
      distinctUntilChanged((a, b) => getPrimoHostRecordKey(a) === getPrimoHostRecordKey(b))
    );

    // Drive displayInfo$ from a single pipeline keyed on the current host record.
    // Using switchMap cancels the previous record's inner stream immediately on record changes,
    // preventing "stale record + new viewModel" emissions that can overwrite our link state.
    this.displayInfo$ = hostRecord$.pipe(
      switchMap(record => {
        this.debugLog.debug('ThirdIronButtons.ngOnInit.hostRecord', {
          recordKey: getPrimoHostRecordKey(record),
          ...this.debugLog.safeSearchEntityMeta(record),
        });

        const shouldEnhanceButtons = this.searchEntityService.shouldEnhanceButtons(record);
        if (!shouldEnhanceButtons) {
          this.debugLog.debug(
            'ThirdIronButtons.enhance.skip',
            this.debugLog.safeSearchEntityMeta(record)
          );
          this.enterPassthrough('shouldEnhanceButtons=false');
          return of(null);
        }

        this.debugLog.debug('ThirdIronButtons.enhance.start', {
          viewOption: this.viewOption,
          ...this.debugLog.safeSearchEntityMeta(record),
        });

        // Eagerly hide the native Primo buttons and show a loading state *before* the LibKey call
        // resolves. This is what removes the flash: the user never sees the native buttons for
        // enhance-eligible records.
        this.enterLoading();

        return combineLatest([
          this.buttonInfoService.getDisplayInfo(record),
          this.viewModel$,
          this.primoLinkLabels$,
        ]).pipe(
          map(([displayInfo, viewModel, primoLinkLabels]) =>
            this.applyEnhancement(displayInfo, viewModel, primoLinkLabels)
          )
        );
      }),
      takeUntilDestroyed(this.destroyRef),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // The template only reads displayInfo$/viewModel$ (via async pipe) inside the
    // `buttonsPhase === 'enhanced'` block, but it's this very pipeline that *sets* buttonsPhase and
    // performs the eager-hide / skeleton side-effects. Subscribe here so the phase transitions run
    // regardless of what the template is currently rendering. shareReplay lets the template's later
    // async-pipe subscription share this same source (so we don't issue duplicate LibKey calls).
    this.displayInfo$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /**
   * Process a settled LibKey result: decide whether we actually have Third Iron content and
   * transition to the appropriate render phase. Extracted from the pipeline so the loading /
   * enhanced / passthrough transitions live in one place.
   */
  private applyEnhancement(
    displayInfo: DisplayWaterfallResponse,
    viewModel: PrimoViewModel,
    primoLinkLabels: Parameters<ButtonInfoService['buildCombinedLinks']>[2]
  ): DisplayWaterfallResponse {
    this.debugLog.debug('ThirdIronButtons.viewModel', {
      ...getPrimoViewModelMeta(viewModel),
      ariaLabel: viewModel?.ariaLabel ?? null,
    });

    const viewOption = this.viewOption;

    // If the TI API / waterfall yields no TI-specific button(s), we should leave the host Primo UI
    // untouched and render nothing from this component.
    this.hasThirdIronSourceItems = this.hasThirdIronAdditions(displayInfo);

    if (!this.hasThirdIronSourceItems) {
      // Rarer "reverse" path: we eagerly hid the native buttons but there's no TI content to show,
      // so restore them. enterPassthrough handles restore + wrapper collapse + phase reset.
      this.enterPassthrough('hasThirdIronSourceItems=false');
      return displayInfo;
    }

    // We are enhancing this record with at least one TI-provided button (main/secondary/BrowZine).
    // The native Primo online availability UI was already hidden in enterLoading(); keep it hidden.
    if (viewOption !== ViewOptionType.NoStack) {
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
    } else {
      // Build array of Primo only links, filter based on TI config settings.
      // Pass the record's entity type so the link resolver (direct) link can be
      // shown/hidden per entity type (article vs journal).
      this.combinedLinks = [];
      this.primoLinks = this.buttonInfoService.buildPrimoLinks(
        viewModel,
        primoLinkLabels,
        displayInfo.entityType
      );

      // Primo links are re-rendered via our own `stacked-dropdown` in NoStack mode.
    }

    this.commitEnhanced();
    return displayInfo;
  }

  /**
   * Enter the loading phase for an enhance-eligible record: hide the native Primo buttons now,
   * reserve space for our skeleton, and arm the skeleton-delay + max-wait timers.
   */
  private enterLoading(): void {
    this.clearPhaseTimers();
    this.buttonsPhase = 'loading';
    this.showSkeleton = false;
    this.skeletonShownAt = null;

    const hostElem = this.elementRef.nativeElement as HTMLElement;
    const removedCount = this.removePrimoOnlineAvailability(hostElem);
    // Make sure our wrapper is visible so the skeleton (and later, our buttons) can render.
    const wrapperRestored = this.restoreHostWrapper(hostElem);
    this.debugLog.debug('ThirdIronButtons.enterLoading', {
      removedCount,
      wrapperRestored,
    });

    // Only reveal the shimmer if loading actually takes a noticeable amount of time. This avoids a
    // sub-150ms flash for fast/cached responses (native hidden -> straight to our buttons).
    this.skeletonDelayTimer = setTimeout(() => {
      this.skeletonDelayTimer = null;
      if (this.buttonsPhase !== 'loading') return;
      this.showSkeleton = true;
      this.skeletonShownAt = Date.now();
      this.debugLog.debug('ThirdIronButtons.skeleton.show', {});
    }, this.SKELETON_DELAY_MS);

    // Safety net: if the call never settles (very slow / hung), restore the native buttons so the
    // user isn't stranded on a skeleton. If the call resolves later, applyEnhancement runs normally.
    this.maxWaitTimer = setTimeout(() => {
      this.maxWaitTimer = null;
      if (this.buttonsPhase !== 'loading') return;
      this.debugLog.warn('ThirdIronButtons.maxWaitFallback', { maxWaitMs: this.MAX_WAIT_MS });
      this.enterPassthrough('maxWaitFallback');
    }, this.MAX_WAIT_MS);
  }

  /**
   * Commit the 'enhanced' phase so the template renders our buttons. If the skeleton is currently
   * visible, defer the swap until it has been shown for at least SKELETON_MIN_VISIBLE_MS so it
   * can't flash-and-vanish.
   */
  private commitEnhanced(): void {
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    if (this.skeletonDelayTimer) {
      clearTimeout(this.skeletonDelayTimer);
      this.skeletonDelayTimer = null;
    }
    if (this.enhanceCommitTimer) {
      clearTimeout(this.enhanceCommitTimer);
      this.enhanceCommitTimer = null;
    }

    const elapsed = this.skeletonShownAt !== null ? Date.now() - this.skeletonShownAt : 0;
    const remaining = this.SKELETON_MIN_VISIBLE_MS - elapsed;

    if (this.showSkeleton && remaining > 0) {
      this.enhanceCommitTimer = setTimeout(() => {
        this.enhanceCommitTimer = null;
        this.finalizeEnhanced();
      }, remaining);
      return;
    }

    this.finalizeEnhanced();
  }

  private finalizeEnhanced(): void {
    this.showSkeleton = false;
    this.skeletonShownAt = null;
    this.buttonsPhase = 'enhanced';
  }

  /**
   * Leave our UI out entirely and show the native Primo buttons. Used when a record is not
   * enhance-eligible, when the settled result has no TI content, or as the max-wait fallback.
   */
  private enterPassthrough(reason: string): void {
    this.clearPhaseTimers();
    this.resetEnhancementState();
    this.showSkeleton = false;
    this.skeletonShownAt = null;
    this.buttonsPhase = 'passthrough';

    const hostElem = this.elementRef.nativeElement as HTMLElement;
    const restoredCount = this.restorePrimoOnlineAvailability(hostElem);
    this.debugLog.debug('ThirdIronButtons.restorePrimoOnlineAvailability', {
      reason,
      restoredCount,
    });
    // We render nothing in this case; collapse our wrapper so the host flex container's
    // gap doesn't apply between us and the sibling `nde-online-availability`.
    const wrapperHidden = this.hideHostWrapper(hostElem);
    this.debugLog.debug('ThirdIronButtons.hideHostWrapper', {
      reason,
      wrapperHidden,
    });
  }

  private clearPhaseTimers(): void {
    if (this.skeletonDelayTimer) {
      clearTimeout(this.skeletonDelayTimer);
      this.skeletonDelayTimer = null;
    }
    if (this.enhanceCommitTimer) {
      clearTimeout(this.enhanceCommitTimer);
      this.enhanceCommitTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
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

  private resetEnhancementState(): void {
    this.hasThirdIronSourceItems = false;
    this.combinedLinks = [];
    this.primoLinks = [];
  }

  removePrimoOnlineAvailability = (hostElement: HTMLElement): number => {
    // This component is injected *before* the host `nde-online-availability` block.
    // Depending on the host (and `ngComponentOutlet`), our host element may be an `<ng-component>`
    // node or some other wrapper. Walk up the DOM until we find an ancestor that actually contains
    // the `nde-online-availability` element, then hide it.
    // Choosing to look up the tree to a depth of 12 is arbitrary, but seemed a reasonable depth.
    let current: HTMLElement | null = hostElement ?? null;
    for (let depth = 0; current && depth < 12; depth++) {
      const onlineAvailabilityElems = current.getElementsByTagName(
        'nde-online-availability'
      ) as HTMLCollectionOf<HTMLElement>;
      if (onlineAvailabilityElems.length > 0) {
        const arr = Array.from(onlineAvailabilityElems);
        for (const elem of arr) {
          if (elem.dataset['tiOnlineAvailabilityPrevDisplay'] === undefined) {
            // if we need to restore this element later, we will set display back to the original value
            elem.dataset['tiOnlineAvailabilityPrevDisplay'] = elem.style.display ?? '';
          }
          elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'] = '1';
          elem.style.display = 'none';
        }
        return arr.length;
      }
      current = current.parentElement;
    }

    this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability.notFound', {
      maxDepth: 12,
    });
    return 0;
  };

  // Traverse the DOM up to 12 levels (arbitrary depth) to find the `nde-online-availability` element and restore it to its original display value.
  // We only restore elements we previously hid (tiOnlineAvailabilityHiddenByThirdIron dataset is set to '1')
  // After restoring, we delete the tiOnlineAvailabilityHiddenByThirdIron and tiOnlineAvailabilityPrevDisplay dataset attributes (cleanup).
  restorePrimoOnlineAvailability = (hostElement: HTMLElement): number => {
    let current: HTMLElement | null = hostElement ?? null;
    for (let depth = 0; current && depth < 12; depth++) {
      const onlineAvailabilityElems = current.getElementsByTagName(
        'nde-online-availability'
      ) as HTMLCollectionOf<HTMLElement>;
      if (onlineAvailabilityElems.length > 0) {
        const arr = Array.from(onlineAvailabilityElems);
        let restored = 0;
        for (const elem of arr) {
          if (elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'] !== '1') continue;
          const prevDisplay = elem.dataset['tiOnlineAvailabilityPrevDisplay'];
          elem.style.display = prevDisplay ?? '';
          delete elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'];
          delete elem.dataset['tiOnlineAvailabilityPrevDisplay'];
          restored++;
        }
        return restored;
      }
      current = current.parentElement;
    }
    return 0;
  };

  // The host (Primo NDE) renders this component via `*ngComponentOutlet`, which wraps our
  // custom element in an `<ng-component>` element. That `<ng-component>` is a direct child
  // of the host's `.responsive-availability-layout` flex container (which currently sets `gap: .5rem`).
  //
  // When this component has nothing to render (no TI buttons), our own host element is empty
  // (just Angular `<!---->` placeholders), but `<ng-component>` is still a flex item — so the
  // container's gap is still applied between it and the sibling `<nde-online-availability>`,
  // leaving an unwanted blank space to the left of the Primo "Available Online" button.
  //
  // Hiding our own host element doesn't fix this (the flex item is the wrapper, not us), so
  // we walk up to the wrapping `<ng-component>` and hide it instead. We mark our mutation
  // with dataset flags so `restoreHostWrapper` only undoes changes we made.
  hideHostWrapper = (hostElement: HTMLElement): boolean => {
    const wrapper = this.findHostWrapper(hostElement);
    if (!wrapper) return false;
    if (wrapper.dataset['tiWrapperPrevDisplay'] === undefined) {
      wrapper.dataset['tiWrapperPrevDisplay'] = wrapper.style.display ?? '';
    }
    wrapper.dataset['tiWrapperHiddenByThirdIron'] = '1';
    wrapper.style.display = 'none';
    return true;
  };

  // Restore the wrapping `<ng-component>`'s display if (and only if) we previously hid it.
  restoreHostWrapper = (hostElement: HTMLElement): boolean => {
    const wrapper = this.findHostWrapper(hostElement);
    if (!wrapper) return false;
    if (wrapper.dataset['tiWrapperHiddenByThirdIron'] !== '1') return false;
    const prevDisplay = wrapper.dataset['tiWrapperPrevDisplay'];
    wrapper.style.display = prevDisplay ?? '';
    delete wrapper.dataset['tiWrapperHiddenByThirdIron'];
    delete wrapper.dataset['tiWrapperPrevDisplay'];
    return true;
  };

  // Walk up a small fixed number of levels from our host element looking for the
  // `<ng-component>` wrapper. Depth is normally 1, but we allow a few hops in case
  // a future host inserts an extra wrapper.
  private findHostWrapper(hostElement: HTMLElement | null): HTMLElement | null {
    let current: HTMLElement | null = hostElement?.parentElement ?? null;
    for (let depth = 0; current && depth < 4; depth++) {
      if (current.tagName.toLowerCase() === 'ng-component') return current;
      current = current.parentElement;
    }
    return null;
  }
}
