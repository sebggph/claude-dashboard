import { load as get } from '#lib/state.svelte.js';

// /compare?a=<session id>&b=<session id>
export async function load({ url }) {
  const [list] = await Promise.all([get.sessions(), get.guide(), get.live(), get.docs()]);
  const ids = list.sessions.map((s) => s.id);
  let a = url.searchParams.get('a');
  let b = url.searchParams.get('b');
  // Sensible defaults: B = the newest session, A = the one before it in the same project.
  if (!b || !ids.includes(b)) b = ids.find((id) => id !== a) || null;
  if (!a || !ids.includes(a)) {
    const sb = list.sessions.find((s) => s.id === b);
    a = (list.sessions.find((s) => s.id !== b && sb && s.project === sb.project) || list.sessions.find((s) => s.id !== b) || {}).id || null;
  }
  const [sa, sb] = await Promise.all([a ? get.session(a).catch(() => null) : null, b ? get.session(b).catch(() => null) : null]);
  return { a, b, sa, sb };
}
