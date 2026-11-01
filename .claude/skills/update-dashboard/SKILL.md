---
name: update-dashboard
description: Bring the Claude Context Dashboard up to date with the latest Claude Code, model and docs changes. Checks official release notes and docs, updates facts, guides, cheatsheet, recommendations and parser, verifies everything, then updates this skill's own facts and sources. Use when asked to "update the dashboard", "check what's new in Claude", or after a Claude Code release.
disable-model-invocation: true
---

# Update the dashboard to the latest Claude

Last reviewed: Claude Code **v2.1.316**, 2026-10-31

You keep this project accurate as Claude changes. Work in small, checkable steps.
Only use **official sources** (listed in `sources.md`). Never invent commands, numbers or features.
If you can't confirm something, leave it out and list it in your final report.

Optional argument: a focus such as a version (`2.1.320`) or a topic (`compaction`). Focus: $ARGUMENTS

## Files in this skill

- `facts.md`: every Claude fact the dashboard depends on, where it's used in the code, and its source. **The single source of truth.**
- `sources.md`: where to look for changes, and what each source is good for.
- `docs-pages.txt`: the list of official docs pages at the last review (baseline for spotting new pages).

## Step 1: See what changed

1. Read `facts.md` and `sources.md`. Note the "Last reviewed" version above.
2. Refresh the bundled news: `npm run news-snapshot`. Then read `static/data/news-snapshot.json` and list every Claude Code release **newer than the last reviewed version**, plus Platform notes newer than the last reviewed date. (If there's no network, use the changelog page from `sources.md` with your fetch tool.)
3. Run `npm run check`. Section 5 lists docs pages **added or removed** since the last review. Section 4 lists broken links.
4. Read `static/data/live-snapshot.json` (models, latest version) and compare with `facts.md`.

## Step 2: Triage

Make a short table for the user before editing: **Change → Affects → Action**. Use these buckets:

| Bucket | Where in the code |
|---|---|
| Context window / auto-compact rules | `src/lib/rules.js` → `nativeWindow()`, `bufferFor()`; `facts.md` F1–F3 |
| Transcript format (fields, record types) | `src/lib/server/parser.js`; add a test in `test/` |
| Commands, shortcuts, flags (new, renamed, removed) | `static/data/cheatsheet.json` (both languages) |
| Context categories & tips | `static/data/context-guide.json` |
| Recommendation rules & thresholds | `src/lib/rules.js` → `recommendationsFor()` + `context-guide.json` → `recommendations` |
| Guide content | `static/docs/en/*.md` and `static/docs/es/*.md` (same structure in both) |
| News / live sources (format changes) | `src/lib/server/news.js`, `src/lib/server/live.js` |
| New guide idea | `ROADMAP.md` (ask before writing a big new guide) |

Skip changes that don't touch context, cost, setup, commands or habits (e.g. enterprise gateway options, single-platform bug fixes) unless the user asked.

## Step 3: Apply

- Edit both languages every time. Spanish should read naturally; keep commands untranslated.
- Link every new claim to the official page that proves it.
- Keep texts short and plain; keep the UI grid symmetric.
- Never put transcript text in `{@html}`; Svelte escapes normal `{text}`.

## Step 4: Verify

1. `npm test` (parser, news and live parsers).
2. `npm run check` until it passes (or only known-unreachable links remain; say which).
3. Start the app (`npm run dev`, or `npm run build && npm run demo` with no sessions) and look at Home, Dashboard, a session, Learn, Cheatsheet and News in light/dark and EN/ES. Take screenshots if a browser is available.
4. If you have a recent real transcript, open it in the app and confirm the numbers look sane (context % close to `/context`).

## Step 5: Update this skill (always)

1. `facts.md`: update changed facts, add new ones (next F-number), mark removed ones, set "Verified" dates.
2. `sources.md`: add any new useful official source; note any source whose format changed.
3. `npm run check -- --pages --write` to save the new docs-pages baseline.
4. Update "Last reviewed" at the top of this file.
5. If you learned a better way to do any step, edit this file.
6. Add an entry to `CHANGELOG.md` (top): date, Claude versions covered, what changed in the dashboard.

## Step 6: Report

Commit on a branch (not `main`) and tell the user, in plain words:
- What changed in Claude that matters for context and habits.
- What you changed in the dashboard (files, both languages).
- What you could not verify, and anything that needs their decision.
