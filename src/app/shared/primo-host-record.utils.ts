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
    viewModelKeys: viewModel ? Object.keys(viewModel) : [],
  };
};

/**
 * Returns the translation key Primo uses to label its availability button for the given
 * `onlineAvailability` status, mirroring the host's `onlineAvailabilityCode()`.
 */
export const getPrimoAvailabilityCode = (
  onlineAvailability: string | null | undefined
): string => {
  if (onlineAvailability === 'Not available') return 'delivery.code.not_available';
  return onlineAvailability ? `delivery.code.${onlineAvailability}` : '';
};

/**
 * Returns safe debug metadata about the Primo `nde-online-availability` host component: which
 * members it exposes and the availability state Primo uses to decide what its own button does.
 * Only key names, primitives, and a small delivery summary are returned (no PNX / record payloads).
 */
export const getPrimoAvailabilityHostMeta = (host: any): Record<string, unknown> => {
  if (!host || typeof host !== 'object') {
    return { hasHost: false };
  }

  let protoMethods: string[] = [];
  try {
    const proto = Object.getPrototypeOf(host);
    protoMethods =
      proto && proto !== Object.prototype
        ? Object.getOwnPropertyNames(proto).filter(name => name !== 'constructor')
        : [];
  } catch {
    protoMethods = [];
  }

  let delivery: any = null;
  try {
    // `delivery` is a signal input on the Primo host component.
    delivery = host.delivery?.() ?? null;
  } catch {
    delivery = null;
  }

  return {
    hasHost: true,
    ownKeys: Object.keys(host),
    protoMethods,
    hasOnAvailabilityClicked: typeof host.onAvailabilityClicked === 'function',
    onAvailabilityClickedArity:
      typeof host.onAvailabilityClicked === 'function' ? host.onAvailabilityClicked.length : null,
    typeofDelivery: typeof host.delivery,
    onlineAvailability: host.onlineAvailability ?? null,
    openLink: host.openLink ?? null,
    isFullDisplay: host.isFullDisplay ?? null,
    delivery: delivery
      ? {
          deliveryCategory: delivery.deliveryCategory ?? null,
          displayedAvailability: delivery.displayedAvailability ?? null,
          electronicServicesCount: Array.isArray(delivery.electronicServices)
            ? delivery.electronicServices.length
            : 0,
          firstServiceHasAccess: delivery.electronicServices?.[0]?.hasAccess ?? null,
        }
      : null,
  };
};
