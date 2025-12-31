import { Component, ElementRef, Input, ViewEncapsulation, DestroyRef } from '@angular/core';
import {
  Observable,
  ReplaySubject,
  Subscription,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  of,
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
import { StackedDropdownComponent } from 'src/app/components/stacked-dropdown/stacked-dropdown.component';
import { DebugLogService } from 'src/app/services/debug-log.service';

// #region agent log
const __TI_NDE_AGENT_LOG_ENABLED__ = () =>
  (globalThis as any).__TI_NDE_AGENT_LOG_ENABLED__ === true;
const __tiAgentLog = (payload: any) => {
  if (!__TI_NDE_AGENT_LOG_ENABLED__()) return;
  fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
};
// #endregion agent log

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
  /**
   * **Host record proxy stream**.
   * We push whatever the host considers the "current record" (`hostComponent.searchResult`) into this
   * ReplaySubject so:
   * - new subscribers immediately receive the latest record (ReplaySubject(1))
   * - we can react when the host navigates records even if ExLibris store selection is stale/unset
   */
  private hostSearchResult$ = new ReplaySubject<SearchEntity | null>(1);

  /**
   * **Host view model proxy stream**.
   * The host provides `hostComponent.viewModel$`, but in practice the host may:
   * - swap the observable instance over time, or
   * - mutate hostComponent without re-triggering Angular @Input setters here.
   *
   * We subscribe to the current host `viewModel$` and proxy emissions into this stable ReplaySubject
   * so our link-building always uses the latest PrimoViewModel.
   */
  private hostViewModel$ = new ReplaySubject<PrimoViewModel>(1);
  private hostViewModelSub: Subscription | null = null;
  private lastHostViewModelRef: unknown = null;
  private lastHostRecordId: string | null = null;
  private lastUrlDocid: string | null = null;
  private firstDirectLinkSeenForRecordId = new Map<string, string>();
  private firstDirectLinkLoggedForRecordId = new Set<string>();

  private safeDocidFromUrl(rawUrl: unknown): string | null {
    const s = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!s) return null;
    try {
      const u = new URL(s, window.location.href);
      return u.searchParams.get('docid');
    } catch {
      return null;
    }
  }

  /**
   * Backing field for the `@Input() hostComponent` setter/getter.
   * We use a setter so we can run side-effects (push latest record + bind viewModel$) whenever the
   * host updates the input.
   */
  private _hostComponent!: any;

  // Setup setter/getter to keep hostComponent up to date when user navigates records
  @Input()
  set hostComponent(value: any) {
    this._hostComponent = value;

    // #region agent log
    __tiAgentLog({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H1',
      location: 'third-iron-buttons.component.ts:hostComponent:set',
      message: 'hostComponent setter called',
      data: {
        hasHost: !!value,
        recordId: value?.searchResult?.pnx?.control?.recordid?.[0] ?? null,
        hasViewModel$: !!value?.viewModel$,
      },
      timestamp: Date.now(),
    });
    // #endregion agent log

    // Push the latest host searchResult so we can react when host navigates records.
    this.hostSearchResult$.next((this._hostComponent?.searchResult as SearchEntity) ?? null);

    // (Re)bind host viewModel$ to our own ReplaySubject so downstream always sees latest values.
    this.bindHostViewModel();
  }
  get hostComponent(): any {
    return this._hostComponent;
  }
  elementRef: ElementRef;
  combinedLinks: StackLink[] = []; // used to build custom merged array of online services for stack views
  primoLinks: StackLink[] = []; // used to build array of Primo only links for NoStack view option
  showDropdown = false;
  viewOption = this.configService.getViewOption();

  // Expose enum to template
  ViewOptionType = ViewOptionType;

  displayInfo$!: Observable<DisplayWaterfallResponse | null>;
  // Exposed to template (async pipe) and used for link building.
  // We proxy hostComponent.viewModel$ into a stable stream so we can re-bind if the host swaps
  // the observable instance or mutates without re-setting the @Input.
  viewModel$: Observable<PrimoViewModel> = this.hostViewModel$.asObservable();

  constructor(
    private buttonInfoService: ButtonInfoService,
    private searchEntityService: SearchEntityService,
    private configService: ConfigService,
    private debugLog: DebugLogService,
    private destroyRef: DestroyRef,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  ngDoCheck() {
    // Some hosts mutate properties on the same hostComponent object rather than replacing it,
    // which means our @Input setter may not run. Detect those changes and push updates.
    const host = this._hostComponent;
    const nextRecord = (host?.searchResult as SearchEntity) ?? null;
    const nextId = nextRecord?.pnx?.control?.recordid?.[0] ?? null;

    if (nextId !== this.lastHostRecordId) {
      this.lastHostRecordId = nextId;
      this.hostSearchResult$.next(nextRecord);
      this.debugLog.debug('ThirdIronButtons.host.searchResult.changed', {
        ...this.debugLog.safeSearchEntityMeta(nextRecord),
      });

      // #region agent log
      __tiAgentLog({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'third-iron-buttons.component.ts:ngDoCheck',
        message: 'host searchResult recordId changed (ngDoCheck)',
        data: { nextId },
        timestamp: Date.now(),
      });
      // #endregion agent log
    }

    // #region agent log
    // Probe: is the URL docid a reliable "source of truth" for the currently selected record?
    const urlDocid = this.safeDocidFromUrl(window.location.href);
    if (__TI_NDE_AGENT_LOG_ENABLED__() && urlDocid !== this.lastUrlDocid) {
      this.lastUrlDocid = urlDocid;
      __tiAgentLog({
        sessionId: 'debug-session',
        runId: 'run6',
        hypothesisId: 'H9',
        location: 'third-iron-buttons.component.ts:ngDoCheck:urlDocid',
        message: 'window.location docid changed',
        data: {
          urlDocid,
          hostRecordId: nextId,
          hrefPath: (() => {
            try {
              const u = new URL(window.location.href);
              return `${u.pathname}${u.search}${u.hash}`;
            } catch {
              return null;
            }
          })(),
        },
        timestamp: Date.now(),
      });
    }
    // #endregion agent log

    this.bindHostViewModel();
  }

  ngOnDestroy() {
    this.hostViewModelSub?.unsubscribe();
  }

  private bindHostViewModel() {
    // Re-bind only when the host swaps the `viewModel$` reference (common in some MF/host patterns).
    const vmRef = this._hostComponent?.viewModel$ ?? null;

    // #region agent log
    const vmRefChanged = !!vmRef && vmRef !== this.lastHostViewModelRef;
    if (!vmRef || vmRefChanged) {
      __tiAgentLog({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H2',
        location: 'third-iron-buttons.component.ts:bindHostViewModel',
        message: 'bindHostViewModel check',
        data: { hasVmRef: !!vmRef, vmRefChanged },
        timestamp: Date.now(),
      });
    }
    // #endregion agent log

    if (!vmRef || vmRef === this.lastHostViewModelRef) return;

    this.lastHostViewModelRef = vmRef;
    this.hostViewModelSub?.unsubscribe();

    this.debugLog.debug('ThirdIronButtons.host.viewModel$.bound', {
      hasViewModel$: true,
    });

    this.hostViewModelSub = (vmRef as Observable<PrimoViewModel>).subscribe({
      next: vm => {
        const hostRecordId = this._hostComponent?.searchResult?.pnx?.control?.recordid?.[0] ?? null;
        const rawDirectLink = (vm as any)?.directLink ?? null;
        const urlDocid = this.safeDocidFromUrl(window.location.href);
        const directLinkDocid = this.safeDocidFromUrl(rawDirectLink);

        const isFullDisplayLink =
          typeof rawDirectLink === 'string' && rawDirectLink.includes('/fulldisplay');
        const isLinkResolverLink =
          typeof rawDirectLink === 'string' && rawDirectLink.includes('/view/action/uresolver.do');

        // #region agent log
        // Probe: is the *first* viewModel.directLink after a record change the "right" one to use as stable link?
        if (__TI_NDE_AGENT_LOG_ENABLED__() && hostRecordId) {
          const directLinkStr = typeof rawDirectLink === 'string' ? rawDirectLink : '';
          const hadFirst = this.firstDirectLinkSeenForRecordId.has(hostRecordId);
          if (!hadFirst && directLinkStr) {
            this.firstDirectLinkSeenForRecordId.set(hostRecordId, directLinkStr);
          }

          const first = this.firstDirectLinkSeenForRecordId.get(hostRecordId) ?? null;
          if (!this.firstDirectLinkLoggedForRecordId.has(hostRecordId) && first) {
            this.firstDirectLinkLoggedForRecordId.add(hostRecordId);
            __tiAgentLog({
              sessionId: 'debug-session',
              runId: 'run8',
              hypothesisId: 'H12',
              location: 'third-iron-buttons.component.ts:hostViewModelSub:next:firstDirectLink',
              message: 'first viewModel.directLink observed for record',
              data: {
                hostRecordId,
                urlDocid,
                firstDirectLinkIsFullDisplay: first.includes('/fulldisplay'),
                firstDirectLinkIsResolver: first.includes('/view/action/uresolver.do'),
                firstDirectLinkDocid: this.safeDocidFromUrl(first),
              },
              timestamp: Date.now(),
            });
          }

          if (first && directLinkStr && first !== directLinkStr) {
            __tiAgentLog({
              sessionId: 'debug-session',
              runId: 'run8',
              hypothesisId: 'H12',
              location: 'third-iron-buttons.component.ts:hostViewModelSub:next:directLinkChanged',
              message: 'viewModel.directLink changed after first emission for record',
              data: {
                hostRecordId,
                urlDocid,
                firstDirectLinkDocid: this.safeDocidFromUrl(first),
                currentDirectLinkDocid: directLinkDocid,
                currentIsFullDisplay: isFullDisplayLink,
                currentIsResolver: isLinkResolverLink,
              },
              timestamp: Date.now(),
            });
          }
        }
        // #endregion agent log

        // #region agent log
        if (__TI_NDE_AGENT_LOG_ENABLED__()) {
          __tiAgentLog({
            sessionId: 'debug-session',
            runId: 'run6',
            hypothesisId: 'H9',
            location: 'third-iron-buttons.component.ts:hostViewModelSub:next:docidProbe',
            message: 'docid probe on host viewModel$ emission',
            data: {
              hostRecordId,
              urlDocid,
              directLinkDocid,
              directLinkIsFullDisplay: isFullDisplayLink,
              directLinkIsResolver: isLinkResolverLink,
            },
            timestamp: Date.now(),
          });
        }
        // #endregion agent log

        this.hostViewModel$.next(vm);
        this.debugLog.debug('ThirdIronButtons.host.viewModel$.next', {
          directLink: (vm as any)?.directLink ?? null,
          onlineLinksCount: (vm as any)?.onlineLinks?.length ?? 0,
        });

        // #region agent log
        __tiAgentLog({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H3',
          location: 'third-iron-buttons.component.ts:hostViewModelSub:next',
          message: 'host viewModel$ emitted',
          data: {
            directLink: (vm as any)?.directLink ?? null,
            onlineLinksCount: (vm as any)?.onlineLinks?.length ?? 0,
            hostRecordId: this._hostComponent?.searchResult?.pnx?.control?.recordid?.[0] ?? null,
          },
          timestamp: Date.now(),
        });
        // #endregion agent log
      },
      error: err => {
        this.debugLog.warn('ThirdIronButtons.host.viewModel$.error', {
          err: this.debugLog.safeError(err),
        });
      },
    });
  }

  ngOnInit() {
    const hostRecord$ = this.hostSearchResult$.pipe(
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

        return combineLatest([this.buttonInfoService.getDisplayInfo(record), this.viewModel$]).pipe(
          map(([displayInfo, viewModel]) => {
            // #region agent log
            __tiAgentLog({
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'H4',
              location: 'third-iron-buttons.component.ts:enhance:map',
              message: 'enhance map combining displayInfo + viewModel',
              data: {
                recordId: record?.pnx?.control?.recordid?.[0] ?? null,
                viewModelDirectLink: (viewModel as any)?.directLink ?? null,
                viewModelOnlineLinksCount: (viewModel as any)?.onlineLinks?.length ?? 0,
                mainButtonType: (displayInfo as any)?.mainButtonType ?? null,
                viewOption: this.viewOption,
              },
              timestamp: Date.now(),
            });
            // #endregion agent log

            // #region agent log
            if (__TI_NDE_AGENT_LOG_ENABLED__()) {
              __tiAgentLog({
                sessionId: 'debug-session',
                runId: 'run6',
                hypothesisId: 'H9',
                location: 'third-iron-buttons.component.ts:enhance:map:docidProbe',
                message: 'docid probe on enhance map',
                data: {
                  hostRecordId: record?.pnx?.control?.recordid?.[0] ?? null,
                  urlDocid: this.safeDocidFromUrl(window.location.href),
                  viewModelDirectLinkDocid: this.safeDocidFromUrl(
                    (viewModel as any)?.directLink ?? null
                  ),
                },
                timestamp: Date.now(),
              });
            }
            // #endregion agent log

            if (this.viewOption !== ViewOptionType.NoStack) {
              // build custom stack options array for StackPlusBrowzine and SingleStack view options
              this.combinedLinks = this.buttonInfoService.buildCombinedLinks(
                displayInfo,
                viewModel
              );

              // remove Primo generated buttons/stack if we have a custom stack
              if (this.combinedLinks.length > 0) {
                const hostElem = this.elementRef.nativeElement; // this component's template element
                const removedCount = this.removePrimoOnlineAvailability(hostElem);
                this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                  reason: 'combinedLinks>0',
                  removedCount,
                });
              }
            } else if (this.viewOption === ViewOptionType.NoStack) {
              // Build array of Primo only links, filter based on TI config settings
              this.primoLinks = this.buttonInfoService.buildPrimoLinks(viewModel);

              // remove Primo "Online Options" button or Primo's stack (quick links and direct link)
              // Will be replaced with our own primoLinks options
              const hostElem = this.elementRef.nativeElement; // this component's template element
              const removedCount = this.removePrimoOnlineAvailability(hostElem);
              this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
                reason: 'NoStack',
                removedCount,
              });
            }

            // #region agent log
            __tiAgentLog({
              sessionId: 'debug-session',
              runId: 'run4',
              hypothesisId: 'H7',
              location: 'third-iron-buttons.component.ts:enhance:map:links',
              message: 'computed link arrays',
              data: {
                recordId: record?.pnx?.control?.recordid?.[0] ?? null,
                viewOption: this.viewOption,
                combinedLinksCount: this.combinedLinks?.length ?? 0,
                primoLinksCount: this.primoLinks?.length ?? 0,
                firstCombinedUrl: this.combinedLinks?.[0]?.url ?? null,
                firstPrimoUrl: this.primoLinks?.[0]?.url ?? null,
              },
              timestamp: Date.now(),
            });
            // #endregion agent log

            return displayInfo;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    );
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
