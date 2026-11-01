# Changelog

Content and feature updates to the dashboard. Newest first. The `/update-dashboard` skill adds an entry each time it runs.

## 2026-11-01: v0.3.1

- Docker uses the first free port from 3000 to 3010 when 3000 is taken. New `npm run docker` keeps the address stable and prints the link.

## 2026-11-01: v0.3

- Rebuilt on **SvelteKit 3 + Svelte 5 + Vite** (adapter-node), plain CSS, no CSS framework. Real page URLs (`/sessions/<id>`, `/learn/<guide>`), `npm run dev` with hot reload, two-stage Docker build.
- New **Security & guardrails** section in Learn: secure setup (tutorial), prompt injection, code quality & security reviews, guardrails and monitoring agents.
- Cheatsheet: new "Security & code quality" section.

## 2026-10-31: v0.2

Covers Claude Code up to **v2.1.316** and Platform notes up to 2026-10-30.

- Home screen with links to every section, latest session snapshot and context news.
- News page: Claude Code changelog and Platform release notes, refreshed every 6 hours, with context-related items highlighted.
- Live facts: current models (context window, max output, default effort), latest Claude Code version, service status.
- Learn hub with sections, reading time, levels, read tracking and tickable tutorial steps.
- New guides: compaction; change mid-session or start fresh; tutorials for new and existing projects.
- `/update-dashboard` project skill, facts registry and `npm run check`.

## 2026-10-31: v0.1

- First version: sessions, `/context`-style breakdown, recommendations, guides, cheatsheet, EN/ES, light/dark, Docker.
