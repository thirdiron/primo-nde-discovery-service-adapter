import { Component, ElementRef, Input } from '@angular/core';
import { SearchEntity } from '../../types/searchEntity.types';
import { Observable, filter, switchMap, tap, shareReplay } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JournalCoverService } from '../../services/journal-cover.service';
import { SearchEntityService } from '../../services/search-entity.service';
import { HostComponentProxy } from 'src/app/shared/host-component-proxy';
import {
  getPrimoHostRecordKey,
  getPrimoHostShape,
  resolvePrimoHostRecord,
} from 'src/app/shared/primo-host-record.utils';
import { DebugLogService } from 'src/app/services/debug-log.service';

@Component({
  selector: 'custom-third-iron-journal-cover',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './third-iron-journal-cover.component.html',
  styleUrl: './third-iron-journal-cover.component.scss',
  providers: [JournalCoverService, SearchEntityService],
})
export class ThirdIronJournalCoverComponent {
  // **Host record proxy**:
  // The host can mutate `hostComponent.item` in-place as the user navigates records.
  // HostComponentProxy turns that mutable input into a stable `record$` stream (ReplaySubject(1)),
  // so new subscribers get the latest record and we can react on record-id changes.
  private readonly hostProxy = new HostComponentProxy<SearchEntity, never>({
    // look for changes in item (journal cover section) or searchResult (article detail section)
    getRecord: host => resolvePrimoHostRecord(host),
    getRecordId: record => getPrimoHostRecordKey(record),
    // Journal cover doesn't need a view model stream; we only proxy the current record.
    getViewModel$: () => null,
  });

  /**
   * Backing field for the `@Input() hostComponent` setter/getter.
   * We use a setter so we can run side-effects (push latest record into `record$`) whenever the host
   * updates the input.
   */
  private _hostComponent!: any;

  // Setup setter/getter to keep hostComponent up to date when user navigates records
  @Input()
  set hostComponent(value: any) {
    this._hostComponent = value;
    const cycle = this.hostProxy.setHostComponent(value);
    this.debugLog.debug('ThirdIronJournalCover.hostProxy.setHostComponent', {
      cycle,
      hostShape: getPrimoHostShape(value),
      hostRecord: this.debugLog.safeSearchEntityMeta(resolvePrimoHostRecord(value)),
    });
  }
  get hostComponent(): any {
    return this._hostComponent;
  }

  journalCoverUrl$!: Observable<string>;
  elementRef: ElementRef;

  constructor(
    private journalCoverService: JournalCoverService,
    private debugLog: DebugLogService,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  ngDoCheck() {
    // Some hosts mutate properties in-place rather than replacing the hostComponent object.
    // Keep our proxied record stream up to date even if the @Input setter doesn't re-run.
    this.hostProxy.doCheck();
  }

  ngOnDestroy() {
    this.hostProxy.destroy();
  }

  ngOnInit() {
    // Compose a single stream that maps the current host record to a cover URL and
    // performs side-effects (hide default images) without extra subscriptions.
    this.journalCoverUrl$ = this.hostProxy.record$.pipe(
      filter((record): record is SearchEntity => !!record),
      tap(record => {
        this.debugLog.debug('ThirdIronJournalCover.hostRecord', {
          recordKey: getPrimoHostRecordKey(record),
          ...this.debugLog.safeSearchEntityMeta(record),
        });
      }),
      // Delegate all eligibility/identifier checks to JournalCoverService.
      switchMap(record => this.journalCoverService.getJournalCoverUrl(record)),
      tap(journalCoverUrl => {
        const hostElem = this.elementRef.nativeElement as HTMLElement; // this component's template element
        // jump up to parent of <nde-record-image />
        const imageBlockParent = hostElem.parentNode?.parentNode as HTMLElement | null;

        // hide default Primo image blocks if we find a Third Iron provided image
        if (journalCoverUrl !== '') {
          this.debugLog.debug('ThirdIronJournalCover.cover.apply', {
            hasCover: true,
            coverUrlPresent: !!journalCoverUrl,
          });
          this.hidePrimoRecordImages(imageBlockParent);
          return;
        }

        // No cover for this record: restore Primo images if we previously hid them.
        this.debugLog.debug('ThirdIronJournalCover.cover.apply', {
          hasCover: false,
          coverUrlPresent: false,
        });
        this.restorePrimoRecordImages(imageBlockParent);
      }),
      // Ensure a single shared subscription for the async pipe and any other consumers
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private hidePrimoRecordImages(imageBlockParent: HTMLElement | null): void {
    const imageElements = imageBlockParent?.getElementsByTagName('nde-record-image') as
      | HTMLCollectionOf<HTMLElement>
      | undefined;
    if (!imageElements || imageElements.length === 0) return;
    Array.from(imageElements as HTMLCollectionOf<HTMLElement>).forEach((elem: HTMLElement) => {
      if (elem.dataset['tiPrevDisplay'] === undefined) {
        elem.dataset['tiPrevDisplay'] = elem.style.display ?? '';
      }
      elem.dataset['tiHiddenByThirdIron'] = '1';
      elem.style.display = 'none';
    });
  }

  private restorePrimoRecordImages(imageBlockParent: HTMLElement | null): void {
    const imageElements = imageBlockParent?.getElementsByTagName('nde-record-image') as
      | HTMLCollectionOf<HTMLElement>
      | undefined;
    if (!imageElements || imageElements.length === 0) return;
    Array.from(imageElements as HTMLCollectionOf<HTMLElement>).forEach((elem: HTMLElement) => {
      if (elem.dataset['tiHiddenByThirdIron'] !== '1') return;
      const prevDisplay = elem.dataset['tiPrevDisplay'];
      elem.style.display = prevDisplay ?? '';
      delete elem.dataset['tiHiddenByThirdIron'];
      delete elem.dataset['tiPrevDisplay'];
    });
  }
}
