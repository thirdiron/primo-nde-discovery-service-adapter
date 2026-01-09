export type DebugChangeListener = (enabled: boolean) => void;

const NAMESPACE = '__TI_NDE__';
const STORAGE_KEY = '__TI_NDE_DEBUG__';

type DebugApi = {
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  isEnabled: () => boolean;
  help: () => void;
};

type NamespaceApi = {
  debug: DebugApi;
  debugEnabled?: boolean;
};

function safeGetLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// If localStorage is not available, we 'fail closed' and return false.
// This makes it so the default value for debugging is false.
function readPersistedEnabled(): boolean {
  const ls = safeGetLocalStorage();
  if (!ls) return false;
  const raw = ls.getItem(STORAGE_KEY);
  return raw === '1' || raw === 'true';
}

// Variant of `readPersistedEnabled()` used during install-time reconciliation:
// - Returns `undefined` when `localStorage` is unavailable/blocked, instead of defaulting to `false`.
// - This prevents us from clobbering a runtime-enabled debug flag living on `window.__TI_NDE__.debugEnabled`
//   (e.g., in Module Federation / multi-bundle scenarios) just because persistence is inaccessible.
function readPersistedEnabledIfAvailable(): boolean | undefined {
  const ls = safeGetLocalStorage();
  if (!ls) return undefined;
  const raw = ls.getItem(STORAGE_KEY);
  return raw === '1' || raw === 'true';
}

function writePersistedEnabled(enabled: boolean): void {
  const ls = safeGetLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore persistence failures (private mode, storage full, blocked, etc.)
  }
}

// Singleton state (module-level)
let enabled = readPersistedEnabled();
const listeners = new Set<DebugChangeListener>();

export function isDebugEnabled(): boolean {
  // In Module Federation scenarios it’s possible to end up with multiple copies of this module.
  // Use the global namespace as the source of truth when available.
  const globalEnabled = (globalThis as any)?.[NAMESPACE]?.debugEnabled;
  if (typeof globalEnabled === 'boolean') return globalEnabled;
  return enabled;
}

export function setDebugEnabled(next: boolean): void {
  if (isDebugEnabled() === next) return;
  enabled = next;
  writePersistedEnabled(enabled);
  try {
    const root: any = globalThis as any;
    if (root?.[NAMESPACE]) {
      root[NAMESPACE].debugEnabled = enabled;
    }
  } catch {
    // ignore
  }
  for (const l of Array.from(listeners)) {
    try {
      l(enabled);
    } catch {
      // listener bugs should not break app
    }
  }
}

export function subscribeToDebugChanges(listener: DebugChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ensureNamespace(root: any): NamespaceApi {
  if (!root[NAMESPACE]) root[NAMESPACE] = {};
  if (!root[NAMESPACE].debug) root[NAMESPACE].debug = {};
  return root[NAMESPACE] as NamespaceApi;
}

export function installDebugApi(root: any = globalThis): NamespaceApi {
  const ns = ensureNamespace(root);
  // Ensure a single shared boolean lives on the namespace for cross-bundle access.
  if (typeof ns.debugEnabled !== 'boolean') {
    ns.debugEnabled = readPersistedEnabled();
  }
  enabled = ns.debugEnabled;

  // Idempotent install: always (re)bind methods to current module state.
  ns.debug.enable = () => {
    setDebugEnabled(true);
    // eslint-disable-next-line no-console
    console.info('[TI-NDE] Debug enabled');
  };
  ns.debug.disable = () => {
    setDebugEnabled(false);
    // eslint-disable-next-line no-console
    console.info('[TI-NDE] Debug disabled');
  };
  ns.debug.toggle = () => {
    const next = !isDebugEnabled();
    setDebugEnabled(next);
    // eslint-disable-next-line no-console
    console.info(`[TI-NDE] Debug ${next ? 'enabled' : 'disabled'}`);
  };
  ns.debug.isEnabled = () => isDebugEnabled();
  ns.debug.help = () => {
    // Keep this console output un-gated; it’s explicitly user-invoked.
    // Strict policy: no sensitive info.
    // eslint-disable-next-line no-console
    console.info('[TI-NDE] Debug mode help', {
      enable: 'window.__TI_NDE__.debug.enable()',
      disable: 'window.__TI_NDE__.debug.disable()',
      toggle: 'window.__TI_NDE__.debug.toggle()',
      isEnabled: 'window.__TI_NDE__.debug.isEnabled()',
      persistence: { storageKey: STORAGE_KEY, values: ['1', '0'] },
    });
  };

  // Keep namespace flag in sync with persisted value when localStorage is available.
  // IMPORTANT: do NOT overwrite a runtime-enabled debug flag with `false` when storage is blocked
  // (private mode, storage denied) because `readPersistedEnabled()` must default to false.
  const persisted = readPersistedEnabledIfAvailable();
  if (typeof persisted === 'boolean') {
    ns.debugEnabled = persisted;
    enabled = persisted;
  } else {
    // Ensure module-level state matches the namespace runtime state.
    enabled = ns.debugEnabled;
  }
  return ns;
}
