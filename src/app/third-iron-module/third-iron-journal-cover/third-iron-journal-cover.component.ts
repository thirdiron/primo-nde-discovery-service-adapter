import { Component, ElementRef, Input } from '@angular/core';
import { SearchEntity } from '../../types/searchEntity.types';
import { Observable, ReplaySubject, filter, switchMap, tap, shareReplay } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JournalCoverService } from '../../services/journal-cover.service';
import { ExlibrisStoreService } from '../../services/exlibris-store.service';

@Component({
  selector: 'custom-third-iron-journal-cover',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './third-iron-journal-cover.component.html',
  styleUrl: './third-iron-journal-cover.component.scss',
  providers: [JournalCoverService],
})
export class ThirdIronJournalCoverComponent {
  // This holds the latest hostComponent.item record and replays it to new subscribers.
  // This matters because the host can change records over time, and we want our addon to react (re-evaluate the journal cover URL with the new record)
  // even if the host doesn’t update the store selection immediately.
  private hostItem$ = new ReplaySubject<SearchEntity | null>(1);
  private _hostComponent!: any;

  // Setup setter/getter to keep hostComponent up to date when user navigates records
  @Input()
  set hostComponent(value: any) {
    this._hostComponent = value;
    this.hostItem$.next((this._hostComponent?.item as SearchEntity) ?? null);
  }
  get hostComponent(): any {
    return this._hostComponent;
  }

  journalCoverUrl$!: Observable<string>;
  elementRef: ElementRef;

  constructor(
    private journalCoverService: JournalCoverService,
    private exlibrisStoreService: ExlibrisStoreService,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  ngOnInit() {
    // The raw hostComponent.searchResult is not an observable,
    // so we need to use the ExLibris store to get the up to date record.
    // Compose a single stream that maps the record to a cover URL and
    // performs side-effects (hide default images) without extra subscriptions.
    this.journalCoverUrl$ = this.exlibrisStoreService.getRecordForEntity$(this.hostItem$).pipe(
      filter((record): record is SearchEntity => !!record),
      switchMap(record => this.journalCoverService.getJournalCoverUrl(record)),
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
