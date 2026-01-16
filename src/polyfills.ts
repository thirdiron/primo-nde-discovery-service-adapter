/*
 * Minimal polyfills for this project.
 *
 * Some UMD bundles (including `es6-3i-unpaywall`) expect a Node-like `global`.
 * In browsers, we alias it to `globalThis` so the bundle can initialize.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).global = globalThis;
