/**
 * Webpack-provided `global` shim.
 *
 * Some dependencies (e.g. UMD bundles, es6-3i-unpaywall) reference a Node-like `global` identifier.
 * In an ESM Module Federation build, `global` is not implicitly available, so we
 * provide it via webpack's ProvidePlugin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

// Also set a property for any code that checks `globalThis.global`
if (!('global' in g)) {
  g.global = g;
}

export default g;
