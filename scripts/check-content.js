// Content checks for the dashboard. Run: npm run check
//
//   node scripts/check-content.js            all checks (needs internet for links)
//   node scripts/check-content.js --offline  skip link and docs-page checks
//   node scripts/check-content.js --pages --write
//                                            also save the current official docs
//                                            page list as the new baseline
//
// Checks:
//   1. Every UI string exists in English and Spanish.
//   2. Guides: same files in docs/en and docs/es, index.json entries exist,
//      and in-app links (#/guides/<file>) point to real guides.
//   3. Data files (cheatsheet, context guide) have both languages.
//   4. Every external link in docs, data and READMEs still works.
//   5. Pages added to / removed from the official docs since the last review
//      (compares https://code.claude.com/docs/llms.txt with a saved baseline).

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const WRITE = args.has('--write');
const BASELINE = path.join(ROOT, '.claude', 'skills', 'update-dashboard', 'docs-pages.txt');
const LLMS = 'https://code.claude.com/docs/llms.txt';

const problems = [];
const warn = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { problems.push(msg); console.log(`  ✗ ${msg}`); };

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

function walk(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(rel, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}

async function checkStrings() {
  console.log('\n1. UI strings (public/js/i18n.js)');
  const { STRINGS } = await import(path.join(ROOT, 'public/js/i18n.js'));
  const en = Object.keys(STRINGS.en), es = Object.keys(STRINGS.es);
  const missing = en.filter((k) => !es.includes(k)), extra = es.filter((k) => !en.includes(k));
  if (missing.length) fail(`missing in es: ${missing.join(', ')}`);
  if (extra.length) fail(`only in es: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) ok(`${en.length} keys in both languages`);
}

function checkGuides() {
  console.log('\n2. Guides (docs/en, docs/es)');
  const files = { en: walk('docs/en', ['.md']).map((f) => path.basename(f)), es: walk('docs/es', ['.md']).map((f) => path.basename(f)) };
  const onlyEn = files.en.filter((f) => !files.es.includes(f)), onlyEs = files.es.filter((f) => !files.en.includes(f));
  if (onlyEn.length) fail(`only in English: ${onlyEn.join(', ')}`);
  if (onlyEs.length) fail(`only in Spanish: ${onlyEs.join(', ')}`);
  for (const lang of ['en', 'es']) {
    const idx = json(`docs/${lang}/index.json`);
    for (const g of idx) {
      if (!files[lang].includes(g.file)) fail(`${lang}/index.json lists missing file ${g.file}`);
      for (const k of ['title', 'summary', 'section', 'type', 'minutes', 'level']) if (g[k] == null) fail(`${lang}/index.json ${g.file}: missing "${k}"`);
    }
    for (const f of files[lang]) if (!idx.some((g) => g.file === f)) fail(`${lang}/${f} is not in index.json (hidden from the app)`);
    for (const f of files[lang]) {
      const md = read(`docs/${lang}/${f}`);
      for (const m of md.matchAll(/\(#\/guides\/([^)]+)\)/g)) if (!files[lang].includes(m[1])) fail(`${lang}/${f} links to missing guide ${m[1]}`);
    }
  }
  if (!problems.some((p) => /guide|index|only in/.test(p))) ok(`${files.en.length} guides, both languages, all in-app links resolve`);
}

function checkData() {
  console.log('\n3. Data files (public/data)');
  const before = problems.length;
  const both = (obj, where) => { if (!obj || !obj.en || !obj.es) fail(`${where}: needs both "en" and "es"`); };
  const cs = json('public/data/cheatsheet.json');
  for (const sec of cs.sections) {
    both(sec.title, `cheatsheet section ${sec.id}`);
    for (const it of sec.items) { both(it.desc, `cheatsheet ${it.cmd} desc`); both(it.why, `cheatsheet ${it.cmd} why`); }
  }
  const cg = json('public/data/context-guide.json');
  for (const [id, c] of Object.entries(cg.categories)) { both(c.label, `context-guide ${id} label`); both(c.what, `context-guide ${id} what`); (c.tips || []).forEach((t, i) => both(t, `context-guide ${id} tip ${i}`)); }
  for (const r of cg.recommendations) { both(r.title, `recommendation ${r.id} title`); both(r.text, `recommendation ${r.id} text`); }
  if (problems.length === before) ok(`cheatsheet (${cs.sections.reduce((a, s) => a + s.items.length, 0)} items) and context guide are bilingual`);
}

async function fetchStatus(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'claude-context-dashboard-check' } });
      clearTimeout(timer);
      return r.status;
    } catch (e) { if (attempt) return `error: ${e.cause ? e.cause.code || e.cause.message : e.message}`; }
  }
}

async function checkLinks() {
  console.log('\n4. External links');
  const files = [...walk('docs', ['.md']), 'public/data/cheatsheet.json', 'public/data/context-guide.json', 'README.md', 'README.es.md', 'CLAUDE.md', 'server/news.js'];
  const urls = new Map();
  for (const f of files) {
    for (const m of read(f).matchAll(/https?:\/\/[^\s)"'`<>\]]+/g)) {
      const u = m[0].replace(/[.,;:]+$/, '');
      if (/localhost|127\.0\.0\.1|example\.com|\$\{/.test(u)) continue;
      // Not web pages: git clone URLs (private repos answer 404) and install
      // scripts (downloads some networks block). Check these by hand.
      if (/\.git$|\/install\.(sh|ps1|cmd)$/.test(u)) continue;
      if (!urls.has(u)) urls.set(u, new Set());
      urls.get(u).add(f);
    }
  }
  const list = [...urls.keys()];
  let bad = 0;
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).map(async (u) => {
      const st = await fetchStatus(u);
      if (st !== 200) { bad++; fail(`${st} ${u}  (in ${[...urls.get(u)].join(', ')})`); }
    }));
  }
  // Anchors (#section) are not checked by HTTP; the skill checks them by reading the page.
  if (!bad) ok(`${list.length} links OK`);
}

async function checkPages() {
  console.log('\n5. Official docs pages (llms.txt) vs. last review');
  let txt;
  try {
    const r = await fetch(LLMS);
    txt = await r.text();
  } catch (e) { warn.push(`could not fetch ${LLMS}`); console.log(`  ! could not fetch ${LLMS}`); return; }
  const pages = [...new Set([...txt.matchAll(/https:\/\/code\.claude\.com\/docs\/en\/[\w\-/]+/g)].map((m) => m[0].replace(/\.md$/, '')))].sort();
  const base = fs.existsSync(BASELINE) ? fs.readFileSync(BASELINE, 'utf8').split('\n').filter(Boolean) : [];
  const added = pages.filter((p) => !base.includes(p)), removed = base.filter((p) => !pages.includes(p));
  if (!base.length) console.log(`  ! no baseline yet (${pages.length} pages found)`);
  else {
    console.log(`  ${pages.length} pages; ${added.length} new, ${removed.length} removed since last review`);
    added.forEach((p) => console.log(`    + ${p}`));
    removed.forEach((p) => console.log(`    - ${p}`));
  }
  if (WRITE) { fs.writeFileSync(BASELINE, pages.join('\n') + '\n'); ok(`saved baseline to ${path.relative(ROOT, BASELINE)}`); }
}

(async () => {
  console.log('Claude Context Dashboard: content checks');
  await checkStrings();
  checkGuides();
  checkData();
  if (!OFFLINE) { await checkLinks(); await checkPages(); } else console.log('\n(links and docs pages skipped: --offline)');
  console.log(problems.length ? `\n${problems.length} problem(s) found.` : '\nAll checks passed.');
  process.exit(problems.length ? 1 : 0);
})();
