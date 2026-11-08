// Writes the API answers for the sample sessions as JSON files, so the online
// demo (a static site, no server) works the same. Run before a demo build:
//   node scripts/build-demo-data.js && VITE_STATIC_DEMO=1 BASE_PATH=/claude-dashboard npm run build
import fs from 'node:fs';
import path from 'node:path';

process.env.DEMO = '1'; // sample sessions only, never real ones
process.env.NEWS = 'off'; // use the bundled news/models snapshots
const { listSessions, getSession } = await import('../src/lib/server/sessions.js');
const { getNews } = await import('../src/lib/server/news.js');
const { getLive } = await import('../src/lib/server/live.js');

const out = path.join(process.cwd(), 'static', 'demo-api');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'sessions'), { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value));

const list = listSessions();
// Paths on the build machine mean nothing to visitors.
for (const s of list.sessions) delete s.file;
write('sessions.json', list);
for (const s of list.sessions) {
  const d = getSession(s.id);
  delete d.file;
  write(`sessions/${s.id}.json`, d);
}
const { getUsage } = await import('../src/lib/server/sessions.js');
write('usage.json', getUsage(3650));
write('news.json', { ...(await getNews()), disabled: true });
write('live.json', getLive());
console.log(`Demo data: ${list.sessions.length} sessions → ${path.relative(process.cwd(), out)}`);
