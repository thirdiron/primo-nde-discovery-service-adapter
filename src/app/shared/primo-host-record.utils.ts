/**
 * Shared helpers for reading record/view-model context from Primo host components.
 *
 * This file centralizes:
 * - host record extraction across host shapes (`searchResult` vs `item`)
 * - stable record key generation for change detection/de-duping
 * - lightweight debug metadata for host shape and view model state
 *
 * Keeping these helpers here ensures buttons/cover components use consistent
 * host-record logic and avoids duplicating PNX field fallback rules.
 */
import { SearchEntity } from '../types/searchEntity.types';
import { PrimoViewModel } from '../types/primoViewModel.types';

export const resolvePrimoHostRecord = (host: any): SearchEntity | null => {
  return (host?.searchResult as SearchEntity) ?? (host?.item as SearchEntity) ?? null;
};

export const getPrimoHostRecordKey = (
  record: SearchEntity | null | undefined
): string | null => {
  return (
    record?.pnx?.control?.recordid?.[0] ??
    record?.pnx?.addata?.doi?.[0] ??
    record?.pnx?.addata?.issn?.[0] ??
    record?.pnx?.addata?.eissn?.[0] ??
    record?.pnx?.display?.title?.[0] ??
    null
  );
};

export const getPrimoHostShape = (host: any): Record<string, unknown> => {
  return {
    hasSearchResult: !!host?.searchResult,
    hasItem: !!host?.item,
    hasViewModel$: !!host?.viewModel$,
  };
};

/**
 * Returns safe debug metadata for a Primo view model (directLink, onlineLinks count, etc.).
 * For debugging: call this inside a tap or subscription where you have view model values.
 * Example in third-iron-buttons.component.ts:
 *   hostProxy.viewModel$.pipe(
 *     tap(vm => this.debugLog.debug('ThirdIronButtons.viewModel', getPrimoViewModelMeta(vm)))
 *   ).subscribe();
 * Or pass a snapshot: this.debugLog.debug('viewModel', getPrimoViewModelMeta(currentVm));
 */
export const getPrimoViewModelMeta = (
  viewModel: PrimoViewModel | null | undefined
): Record<string, unknown> => {
  return {
    directLink: viewModel?.directLink ?? null,
    onlineLinksCount: Array.isArray(viewModel?.onlineLinks) ? viewModel.onlineLinks.length : 0,
    hasConsolidatedCoverage: !!viewModel?.consolidatedCoverage,
  };
};
