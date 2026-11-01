// Links and file paths that also work when the app is served from a sub-path
// (the online demo on GitHub Pages lives under /claude-dashboard/).
import { resolve, asset } from '$app/paths';

/** True in the static online demo (no server; data comes from JSON files). */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === '1';

/** In-app link: link('/sessions') → '/claude-dashboard/sessions' in the demo. */
export const link = (path) => resolve(path);

/** A file in static/: file('/data/cheatsheet.json'). */
export const file = (path) => asset(path);

/** The base path ('' normally). */
export const BASE = resolve('/').replace(/\/$/, '');

/** Pathname without the base, for "which page am I on" checks. */
export const appPath = (pathname) => (BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname);

// API → files baked by scripts/build-demo-data.js for the static demo.
export function apiURL(path) {
  if (!STATIC_DEMO || !path.startsWith('/api/')) return path.startsWith('/api/') ? path : file(path);
  const p = path.split('?')[0];
  const m = p.match(/^\/api\/sessions\/(.+)$/);
  if (m) return file(`/demo-api/sessions/${m[1]}.json`);
  return file(`/demo-api/${p.slice(5)}.json`);
}
