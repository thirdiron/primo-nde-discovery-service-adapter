import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { tap } from 'rxjs/operators';
import { SearchEntity } from '../types/searchEntity.types';

/**
 * This Service is responsible for getting store values from the ExLibris NDE store.
 */

@Injectable({
  providedIn: 'root',
})
export class ExlibrisStoreService {
  constructor(private store: Store<any>) {}

  private selectSelectedRecordId$(): Observable<string | null> {
    return this.store
      .select((state: any) => state?.['full-display']?.selectedRecordId ?? null)
      .pipe(
        tap(selectedId =>
          console.debug('[ExlibrisStoreService] selectedRecordId$', selectedId)
        ),
        distinctUntilChanged()
      );
  }

  private selectSearchEntities$(): Observable<Record<string, SearchEntity>> {
    return this.store
      .select((state: any) => {
        const searchSlice = state?.Search ?? state?.search;
        return (searchSlice?.entities as Record<string, SearchEntity>) ?? {};
      })
      .pipe(
        tap(entities =>
          console.debug(
            '[ExlibrisStoreService] entities$ size',
            entities ? Object.keys(entities).length : 0
          )
        ),
        distinctUntilChanged()
      );
  }

  /**
   * Returns an up-to-date SearchEntity for the current record.
   * - Prefers the record indicated by full-display.selectedRecordId (Full View)
   * - Falls back to the recordId derived from the hostComponent (List View)
   */
  getRecord$(hostComponent: any): Observable<SearchEntity | null> {
    const hostRecordId: string | null =
      hostComponent?.searchResult?.pnx?.control?.recordid?.[0] ?? null;

    return combineLatest([this.selectSelectedRecordId$(), this.selectSearchEntities$()]).pipe(
      map(([selectedRecordId, entities]) => {
        const id = selectedRecordId || hostRecordId;
        const record = id ? (entities[id] ?? null) : null;
        console.debug('[ExlibrisStoreService] getRecord$ resolve', {
          selectedRecordId,
          hostRecordId,
          resolvedId: id,
          hasRecord: !!record,
        });
        return record;
      }),
      distinctUntilChanged()
    );
  }
}
