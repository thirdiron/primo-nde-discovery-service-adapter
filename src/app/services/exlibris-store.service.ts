import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { SearchEntity } from '../types/searchEntity.types';
import { DebugLogService } from './debug-log.service';

/**
 * This Service is responsible for getting state values from the ExLibris NDE store.
 */

@Injectable({
  providedIn: 'root',
})
export class ExlibrisStoreService {
  constructor(
    private store: Store<any>,
    private debugLog: DebugLogService
  ) {}

  /**
   * Selects the currently active Full Display record id from the host store.
   * - Reads state['full-display'].selectedRecordId
   * - Emits null when there is no active selection (e.g., List View)
   * - Emits only when the value actually changes
   */
  private selectSelectedRecordId$(): Observable<string | null> {
    return this.store
      .select((state: any) => state?.['full-display']?.selectedRecordId ?? null)
      .pipe(distinctUntilChanged());
  }

  /**
   * Selects the Search/List View entities map keyed by record id.
   * - Works with 'Search' slice name
   * - Returns an empty object when the slice is missing
   * - Emits only when the map reference actually changes
   */
  private selectSearchEntities$(): Observable<Record<string, SearchEntity>> {
    return this.store
      .select((state: any) => {
        const searchSlice = state?.Search;
        return (searchSlice?.entities as Record<string, SearchEntity>) ?? {};
      })
      .pipe(distinctUntilChanged());
  }

  /**
   * Returns an up-to-date SearchEntity using a provided entity as a fallback source for record id.
   * - Prefers the record indicated by full-display.selectedRecordId (Full View)
   * - Falls back to the provided entity's pnx.control.recordid[0] (List View)
   */
  getRecordForEntity$(entity: SearchEntity | null | undefined): Observable<SearchEntity | null> {
    const fallbackId: string | null = entity?.pnx?.control?.recordid?.[0] ?? null;

    return combineLatest([this.selectSelectedRecordId$(), this.selectSearchEntities$()]).pipe(
      map(([selectedRecordId, entities]) => {
        const id = selectedRecordId || fallbackId;
        const record = id ? (entities[id] ?? null) : null;
        this.debugLog.debug('ExlibrisStore.getRecordForEntity$', {
          selectedRecordId: selectedRecordId ?? null,
          fallbackId,
          chosenId: id ?? null,
          recordFound: !!record,
        });
        return record;
      }),
      distinctUntilChanged()
    );
  }
}
