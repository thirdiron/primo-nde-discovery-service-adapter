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
};

function safeGetLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readPersistedEnabled(): boolean {
  const ls = safeGetLocalStorage();
  if (!ls) return false;
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
  return enabled;
}

export function setDebugEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  writePersistedEnabled(enabled);
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

  // Idempotent install: always (re)bind methods to current module state.
  ns.debug.enable = () => setDebugEnabled(true);
  ns.debug.disable = () => setDebugEnabled(false);
  ns.debug.toggle = () => setDebugEnabled(!isDebugEnabled());
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

  // Sync module state with persisted value each install (helps across reloads)
  // without forcing a write or a change notification.
  enabled = readPersistedEnabled();
  return ns;
}


