import { registerDebugHost } from './debug-controller';

describe('debug-controller', () => {
  describe('registerDebugHost', () => {
    const root = globalThis as any;
    let originalNamespace: unknown;

    const hosts = (): Map<string, unknown> | undefined => root.__TI_NDE__?.debug?.hosts;

    beforeEach(() => {
      originalNamespace = root.__TI_NDE__;
      root.__TI_NDE__ = { debug: {}, debugEnabled: true };
    });

    afterEach(() => {
      root.__TI_NDE__ = originalNamespace;
    });

    it('does nothing while debug mode is disabled', () => {
      root.__TI_NDE__.debugEnabled = false;
      registerDebugHost('rec1', { a: 1 });
      expect(hosts()).toBeUndefined();
    });

    it('ignores a missing record id or host', () => {
      registerDebugHost(null, { a: 1 });
      registerDebugHost('rec1', null);
      expect(hosts()).toBeUndefined();
    });

    it('stores the latest host per record id', () => {
      const first = { v: 1 };
      const second = { v: 2 };
      registerDebugHost('rec1', first);
      registerDebugHost('rec1', second);
      registerDebugHost('rec2', first);

      expect(hosts()?.get('rec1')).toBe(second);
      expect(hosts()?.get('rec2')).toBe(first);
      expect(hosts()?.size).toBe(2);
    });

    it('evicts the least recently registered hosts beyond the cap', () => {
      for (let i = 0; i < 55; i++) {
        registerDebugHost(`rec${i}`, { i });
      }
      // Re-registering moves a record to the most-recent end, so it survives eviction.
      registerDebugHost('rec5', { i: 5 });
      registerDebugHost('rec55', { i: 55 });

      expect(hosts()?.size).toBe(50);
      expect(hosts()?.has('rec0')).toBeFalse();
      expect(hosts()?.has('rec6')).toBeFalse();
      expect(hosts()?.has('rec5')).toBeTrue();
      expect(hosts()?.has('rec55')).toBeTrue();
    });
  });
});
