import { Subject } from 'rxjs';
import { HostComponentProxy } from './host-component-proxy';

type TestRecord = { id: string };
type TestViewModel = { value: string };

describe('HostComponentProxy', () => {
  it('record$ should replay the latest record to late subscribers', () => {
    const proxy = new HostComponentProxy<TestRecord, TestViewModel>({
      getRecord: host => (host?.item as TestRecord) ?? null,
      getRecordId: record => record?.id ?? null,
      getViewModel$: host => (host?.viewModel$ as any) ?? null,
    });

    const host = { item: { id: 'a' } as TestRecord };
    proxy.setHostComponent(host);

    const nextSpy = jasmine.createSpy('recordNext');
    proxy.record$.subscribe(nextSpy);

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledWith({ id: 'a' } as TestRecord);
  });

  it('record$ should emit only when record id changes (doCheck detects in-place mutation)', () => {
    const proxy = new HostComponentProxy<TestRecord, TestViewModel>({
      getRecord: host => (host?.item as TestRecord) ?? null,
      getRecordId: record => record?.id ?? null,
      getViewModel$: () => null,
    });

    const host: any = { item: { id: 'a' } as TestRecord };

    const nextSpy = jasmine.createSpy('recordNext');
    proxy.record$.subscribe(nextSpy);

    proxy.setHostComponent(host);
    expect(nextSpy).toHaveBeenCalledTimes(1);

    // In-place mutation: same id -> no new emission
    host.item = { id: 'a' } as TestRecord;
    proxy.doCheck();
    expect(nextSpy).toHaveBeenCalledTimes(1);

    // In-place mutation: different id -> emits
    host.item = { id: 'b' } as TestRecord;
    proxy.doCheck();
    expect(nextSpy).toHaveBeenCalledTimes(2);
    expect(nextSpy.calls.mostRecent().args[0]).toEqual({ id: 'b' } as TestRecord);
  });

  it('viewModel$ should rebind when the host swaps the viewModel$ reference', () => {
    const vm1$ = new Subject<TestViewModel>();
    const vm2$ = new Subject<TestViewModel>();

    const proxy = new HostComponentProxy<TestRecord, TestViewModel>({
      getRecord: () => null,
      getRecordId: () => null,
      getViewModel$: host => (host?.viewModel$ as any) ?? null,
    });

    const host: any = { viewModel$: vm1$.asObservable() };

    const nextSpy = jasmine.createSpy('viewModelNext');
    proxy.viewModel$.subscribe(nextSpy);

    proxy.setHostComponent(host);

    vm1$.next({ value: 'one' });
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledWith({ value: 'one' });

    // Swap the observable reference and rebind on doCheck
    host.viewModel$ = vm2$.asObservable();
    proxy.doCheck();

    // Old stream should no longer forward
    vm1$.next({ value: 'old' });
    expect(nextSpy).toHaveBeenCalledTimes(1);

    // New stream should forward
    vm2$.next({ value: 'two' });
    expect(nextSpy).toHaveBeenCalledTimes(2);
    expect(nextSpy.calls.mostRecent().args[0]).toEqual({ value: 'two' });
  });

  it('destroy() should unsubscribe from the host viewModel$ stream', () => {
    const vm$ = new Subject<TestViewModel>();

    const proxy = new HostComponentProxy<TestRecord, TestViewModel>({
      getRecord: () => null,
      getRecordId: () => null,
      getViewModel$: host => (host?.viewModel$ as any) ?? null,
    });

    const host: any = { viewModel$: vm$.asObservable() };

    const nextSpy = jasmine.createSpy('viewModelNext');
    proxy.viewModel$.subscribe(nextSpy);

    proxy.setHostComponent(host);
    vm$.next({ value: 'before' });
    expect(nextSpy).toHaveBeenCalledTimes(1);

    proxy.destroy();
    vm$.next({ value: 'after' });
    expect(nextSpy).toHaveBeenCalledTimes(1);
  });
});
