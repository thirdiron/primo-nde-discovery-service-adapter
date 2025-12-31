import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import { SearchEntity } from '../types/searchEntity.types';
import { DebugLogService } from './debug-log.service';

/**
 * This Service is responsible for getting state values from the ExLibris NDE store.
 */

@Injectable({
  providedIn: 'root',
})
export class ExlibrisStoreService {
  // Used to determine which id source (selectedRecordId vs fallbackId) changed most recently.
  // We intentionally avoid Date.now() so this remains deterministic in unit tests.
  private seq = 0;
  private selectedSeq = 0;
  private fallbackSeq = 0;

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
  getRecordForEntity$(
    entity$: Observable<SearchEntity | null | undefined>
  ): Observable<SearchEntity | null> {
    // Create one stream that emits whenever any of these three inputs emits,
    // after all three have emitted at least once:
    // -- selectSelectedRecordId$(): current full-display selected record id (or null)
    // -- selectSearchEntities$(): the current Search.entities map from the host store
    // -- entity$ (mapped to fallbackId): the record id derived from the current host entity input (or null)
    // Each emission  from combineLatest gives the latest [selectedRecordId, entitiesMap, fallbackId],
    // and then the following map(...) picks chosenId = selectedRecordId || fallbackId and returns entitiesMap[chosenId] (or null).
    return combineLatest([
      this.selectSelectedRecordId$().pipe(
        tap(() => {
          this.selectedSeq = ++this.seq;
        })
      ),
      this.selectSearchEntities$(),
      entity$.pipe(
        map(entity => entity ?? null),
        map(entity => entity?.pnx?.control?.recordid?.[0] ?? null),
        distinctUntilChanged(),
        tap(() => {
          this.fallbackSeq = ++this.seq;
        })
      ),
    ]).pipe(
      map(([selectedRecordId, entities, fallbackId]) => {
        // If both sources exist but disagree, prefer whichever changed most recently.
        // This addresses cases where full-display.selectedRecordId remains non-null but stale.
        const id = !selectedRecordId
          ? fallbackId
          : !fallbackId
            ? selectedRecordId
            : selectedRecordId === fallbackId
              ? selectedRecordId
              : this.selectedSeq >= this.fallbackSeq
                ? selectedRecordId
                : fallbackId;
        const record = id ? (entities[id] ?? null) : null;

        // #region agent log
        if (
          (globalThis as any).__TI_NDE_AGENT_LOG_ENABLED__ === true &&
          selectedRecordId &&
          fallbackId &&
          selectedRecordId !== fallbackId
        ) {
          fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: 'debug-session',
              runId: 'run2',
              hypothesisId: 'H5',
              location: 'exlibris-store.service.ts:getRecordForEntity$:map',
              message:
                'selectedRecordId differs from fallbackId (possible stale selection override)',
              data: {
                selectedRecordId,
                fallbackId,
                chosenId: id,
                recordFound: !!record,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
        // #endregion agent log

        this.debugLog.debug('ExlibrisStore.getRecordForEntity$', {
          selectedRecordId: selectedRecordId ?? null,
          fallbackId,
          chosenId: id ?? null,
          recordFound: !!record,
        });
        return record;
      }),
      // De-dupe by record id, not by object reference (store updates may reuse objects).
      distinctUntilChanged(
        (a, b) =>
          (a?.pnx?.control?.recordid?.[0] ?? null) === (b?.pnx?.control?.recordid?.[0] ?? null)
      )
    );
  }
}
