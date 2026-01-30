import { Component, ElementRef, Input } from '@angular/core';
import { SearchEntity } from '../../types/searchEntity.types';
import { Observable, filter, switchMap, tap, shareReplay, of } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JournalCoverService } from '../../services/journal-cover.service';
import { SearchEntityService } from '../../services/search-entity.service';
import { HostComponentProxy } from 'src/app/shared/host-component-proxy';

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
    getRecord: host => (host?.item as SearchEntity) ?? null,
    getRecordId: record => record?.pnx?.control?.recordid?.[0] ?? null,
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
    this.hostProxy.setHostComponent(value);
  }
  get hostComponent(): any {
    return this._hostComponent;
  }

  journalCoverUrl$!: Observable<string>;
  elementRef: ElementRef;

  constructor(
    private journalCoverService: JournalCoverService,
    private searchEntityService: SearchEntityService,
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
      switchMap(record => {
        const { shouldEnhanceButtons } = this.searchEntityService.shouldEnhance(record);
        if (!shouldEnhanceButtons) {
          return of('');
        }
        return this.journalCoverService.getJournalCoverUrl(record);
      }),
      tap(journalCoverUrl => {
        // hide default Primo image blocks if we find a Third Iron provided image
        if (journalCoverUrl !== '') {
          const hostElem = this.elementRef.nativeElement; // this component's template element
          const imageBlockParent = hostElem.parentNode?.parentNode; // jump up to parent of <nde-record-image />
          const imageElements = imageBlockParent?.getElementsByTagName('nde-record-image') as
            | HTMLCollectionOf<HTMLElement>
            | undefined;
          if (imageElements && imageElements.length > 0) {
            Array.from(imageElements as HTMLCollectionOf<HTMLElement>).forEach(
              (elem: HTMLElement) => {
                elem.style.display = 'none';
              }
            );
          }
        }
      }),
      // Ensure a single shared subscription for the async pipe and any other consumers
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
