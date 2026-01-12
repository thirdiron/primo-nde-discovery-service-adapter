import { Observable, ReplaySubject, Subscription } from 'rxjs';

export type HostComponentProxyOptions<TRecord, TViewModel> = {
  /**
   * Read the current record off the host component (e.g. host.searchResult).
   */
  getRecord(host: any): TRecord | null;
  /**
   * Return a stable id for de-duping records (e.g. record.pnx.control.recordid[0]).
   */
  getRecordId(record: TRecord | null): string | null;
  /**
   * Read the host viewModel$ observable off the host component.
   */
  getViewModel$(host: any): Observable<TViewModel> | null;
};

/**
 * Converts a host component with mutable fields (often mutated in-place) into stable Observables:
 * - record$: emits when record id changes
 * - viewModel$: emits when host viewModel$ emits; auto-rebinds if host swaps the viewModel$ reference
 *
 * Call:
 * - setHostComponent(...) from @Input setter
 * - doCheck() from ngDoCheck (to detect in-place mutations)
 * - destroy() from ngOnDestroy
 */
export class HostComponentProxy<TRecord, TViewModel> {
  private host: any = null;

  private readonly recordSubject = new ReplaySubject<TRecord | null>(1);
  readonly record$ = this.recordSubject.asObservable();

  private readonly viewModelSubject = new ReplaySubject<TViewModel>(1);
  readonly viewModel$ = this.viewModelSubject.asObservable();

  private viewModelSub: Subscription | null = null;
  private lastViewModelRef: unknown = null;
  private lastRecordId: string | null = null;

  constructor(private readonly opts: HostComponentProxyOptions<TRecord, TViewModel>) {}

  setHostComponent(host: any): void {
    this.host = host;
    this.pushRecordIfChanged(true);
    this.bindHostViewModel();
  }

  doCheck(): void {
    this.pushRecordIfChanged(false);
    this.bindHostViewModel();
  }

  destroy(): void {
    this.viewModelSub?.unsubscribe();
    this.viewModelSub = null;
    this.lastViewModelRef = null;
  }

  private pushRecordIfChanged(force: boolean): void {
    const record = this.opts.getRecord(this.host);
    const recordId = this.opts.getRecordId(record);
    if (force || recordId !== this.lastRecordId) {
      this.lastRecordId = recordId;
      this.recordSubject.next(record);
    }
  }

  private bindHostViewModel(): void {
    const vmRef = this.opts.getViewModel$(this.host);
    if (!vmRef || vmRef === this.lastViewModelRef) return;

    this.lastViewModelRef = vmRef;
    this.viewModelSub?.unsubscribe();
    this.viewModelSub = vmRef.subscribe({
      next: vm => this.viewModelSubject.next(vm),
      // errors are intentionally swallowed; the component can choose to log via its own DebugLogService
      error: () => {},
    });
  }
}


