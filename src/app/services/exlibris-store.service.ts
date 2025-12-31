import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, scan } from 'rxjs/operators';
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
  getRecordForEntity$(
    entity$: Observable<SearchEntity | null | undefined>
  ): Observable<SearchEntity | null> {
    const selectedId$ = this.selectSelectedRecordId$();
    const fallbackId$ = entity$.pipe(
      map(entity => entity ?? null),
      map(entity => entity?.pnx?.control?.recordid?.[0] ?? null),
      distinctUntilChanged()
    );

    // IMPORTANT: This method can be subscribed to multiple times concurrently.
    // Any "most recent wins" logic must be computed per-subscription (inside Rx),
    // not via mutable service-instance fields which can interleave across subscriptions.
    //
    // Also: avoid emitting a "null record" intermediate value before fallbackId is available.
    // We accomplish that by basing decisions on combineLatest(selectedId$, fallbackId$),
    // which does not emit until both have produced at least one value.

    type IdDecisionState = {
      prevSelected: string | null | undefined;
      prevFallback: string | null | undefined;
      lastChanged: 'selected' | 'fallback' | 'both' | 'none';
      selectedRecordId: string | null;
      fallbackId: string | null;
    };

    const ids$ = combineLatest([selectedId$, fallbackId$]).pipe(
      scan(
        (state: IdDecisionState, [selectedRecordId, fallbackId]): IdDecisionState => {
          const selectedChanged = selectedRecordId !== state.prevSelected;
          const fallbackChanged = fallbackId !== state.prevFallback;

          let lastChanged: IdDecisionState['lastChanged'] = state.lastChanged;
          if (selectedChanged && fallbackChanged) {
            lastChanged = 'both';
          } else if (selectedChanged) {
            lastChanged = 'selected';
          } else if (fallbackChanged) {
            lastChanged = 'fallback';
          } else {
            lastChanged = 'none';
          }

          return {
            prevSelected: selectedRecordId,
            prevFallback: fallbackId,
            lastChanged,
            selectedRecordId,
            fallbackId,
          };
        },
        {
          prevSelected: undefined,
          prevFallback: undefined,
          lastChanged: 'none',
          selectedRecordId: null,
          fallbackId: null,
        } satisfies IdDecisionState
      )
    );

    return combineLatest([this.selectSearchEntities$(), ids$]).pipe(
      map(([entities, ids]) => {
        const selectedRecordId = ids.selectedRecordId;
        const fallbackId = ids.fallbackId;

        // If both sources exist but disagree, prefer whichever one changed most recently (per subscription).
        // This addresses cases where full-display.selectedRecordId remains non-null but stale while the host record changes.
        const id = !selectedRecordId
          ? fallbackId
          : !fallbackId
            ? selectedRecordId
            : selectedRecordId === fallbackId
              ? selectedRecordId
              : ids.lastChanged === 'fallback'
                ? fallbackId
                : selectedRecordId;

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
