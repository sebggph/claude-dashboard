// Saves the latest news (and models + Claude Code version) to static/data/,
// the fallback the
// dashboard shows when it can't reach the internet. Run: npm run news-snapshot
import fs from 'node:fs';
import path from 'node:path';
import { refresh } from '../src/lib/server/news.js';
import * as live from '../src/lib/server/live.js';
import { APP_ROOT } from '../src/lib/server/paths.js';

refresh().then((n) => {
  const bad = n.sources.filter((s) => !s.ok);
  if (bad.length) {
    console.error('Some sources failed:', bad.map((s) => `${s.name}: ${s.error}`).join('; '));
    if (bad.length === n.sources.length) process.exit(1);
  }
  const out = path.join(APP_ROOT, 'static', 'data', 'news-snapshot.json');
  fs.writeFileSync(out, JSON.stringify({ ...n, offline: false }, null, 0) + '\n');
  console.log(`Saved ${n.releases.length} releases to ${out}`);
  // Also save models + latest version (status is live-only, never snapshotted).
  return Promise.all([live.refresh('models'), live.refresh('version')]).then(() => {
    const { models, version } = live.getLive();
    const liveOut = path.join(APP_ROOT, 'static', 'data', 'live-snapshot.json');
    fs.writeFileSync(liveOut, JSON.stringify({ models, version }, null, 1) + '\n');
    console.log(`Saved ${models && models.list ? models.list.length : 0} models and version ${version && version.latest} to ${liveOut}`);
  });
});
