import { Component, ElementRef, Input, DestroyRef } from '@angular/core';
import { SearchEntity } from '../../types/searchEntity.types';
import { Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { JournalCoverService } from '../../services/journal-cover.service';
import { ExlibrisStoreService } from '../../services/exlibris-store.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'custom-third-iron-journal-cover',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './third-iron-journal-cover.component.html',
  styleUrl: './third-iron-journal-cover.component.scss',
  providers: [JournalCoverService],
})
export class ThirdIronJournalCoverComponent {
  elementRef: ElementRef;
  constructor(
    private journalCoverService: JournalCoverService,
    private exlibrisStoreService: ExlibrisStoreService,
    private destroyRef: DestroyRef,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  @Input() private hostComponent!: any;
  journalCoverUrl$!: Observable<string>;

  ngOnInit() {
    // Using the raw hostComponent.searchResult is not an observable,
    // so we need to use the ExLibris store to get the up to date record
    this.exlibrisStoreService
      .getRecordForEntity$(this.hostComponent?.item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(record => {
        if (record) {
          this.enhance(record);
        }
      });
  }

  enhance = (searchResult: SearchEntity) => {
    if (searchResult) {
      this.journalCoverUrl$ = this.journalCoverService.getJournalCoverUrl(searchResult);

      this.journalCoverUrl$.subscribe(journalCoverUrl => {
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
      });
    }
  };
}
