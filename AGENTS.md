# AGENTS.md - Coding Agent Instructions

## Project Overview

Cometode is a macOS menu bar app for tracking coding-interview problem practice with spaced repetition. Electron + Svelte 5 + TypeScript + Tailwind CSS 4 + better-sqlite3. Lives in the tray (no dock icon); popup is a compact BrowserWindow.

Problem catalog is local JSON (`src/main/db/` seed data). Progress is local SQLite. Cross-machine sync is a shared JSON file (Dropbox / iCloud / any folder), not a server.

## Build / Lint / Test

```bash
pnpm dev                 # Dev server with hot reload
pnpm start               # Preview production build

pnpm typecheck           # Full typecheck (TypeScript + Svelte)
pnpm typecheck:node      # Main + preload only
pnpm svelte-check        # Svelte-specific type checking

pnpm lint                # ESLint with cache
pnpm format              # Prettier

pnpm build               # Production build (runs typecheck first)
pnpm build:mac           # macOS .dmg + .zip (signed + notarized in CI)
```

No test framework. Verify with `pnpm typecheck`. If adding tests: Vitest + Playwright E2E, `__tests__/` or `.test.ts`.

`package.json` version stays `1.0.0` in git. CI sets the real version from the git tag.

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # Tray, popup window, auto-updater, auto-sync loop
│   ├── ipc.ts            # ipcMain.handle registry
│   ├── db/
│   │   ├── index.ts      # Schema, runMigrations(), initDatabase()
│   │   └── seed.ts       # Load problems from JSON into SQLite
│   └── lib/
│       ├── cir.ts        # CIR spaced-repetition algorithm (active)
│       ├── sm2.ts        # Legacy SM-2 (do not use for new reviews)
│       └── sync-data.ts  # Export/import JSON shape + merge helpers
├── preload/
│   ├── index.ts          # contextBridge API
│   └── index.d.ts        # Shared types + window.api (renderer imports these)
└── renderer/src/
    ├── App.svelte        # Shell, settings, manual routing (no SvelteKit)
    ├── stores/           # Classic svelte/store writables (not runes)
    └── components/       # HomeView, ProblemView, ActivityGraph, …
```

Build tool: **electron-vite** (`electron.vite.config.ts`), not plain Vite.

## Domain Model

SQLite file: `{userData}/cometode.db`.

| Table | Role |
| ----- | ---- |
| `problems` | Catalog + per-problem flags (`starred`, `blocked`, `in_*` set membership) |
| `problem_progress` | CIR state (status, interval, ease, success_rate, dates) |
| `review_history` | One row per review (activity heatmap / streak) |
| `preferences` | Key/value (`sync_enabled`, `sync_folder_path`, shortcut, theme, …) |

- Identify problems across devices by `neet_id`, never local `id`.
- `starred` / `blocked` live on `problems`, **not** `problem_progress`.
- Problem sets: `neetcode150` | `google` | `amazon` | `meta` | `microsoft` | `starred` | `all`. Membership is `in_*` columns; `starred` filters `starred = 1`.
- Progress is shared across sets for the same `neet_id`.
- Review quality: `0` Again, `1` Hard, `2` Good, `3` Easy (`src/main/lib/cir.ts`).

## Sync / Import-Export

Export format version is `1.3` (`EXPORT_VERSION` in `src/main/lib/sync-data.ts`). File: `cometode-progress.json`.

```
{
  version, exportDate, appVersion,
  progress:        [{ neet_id, status, CIR fields, last_reviewed_at, … }],
  reviewHistory?:  [{ neet_id, review_date, quality, … }],   // v1.2+
  problemFlags?:   [{ neet_id, starred, blocked }]           // v1.3+
}
```

`buildExportData()` always writes all three. `fetchProblemFlags()` only includes rows where starred or blocked is 1.

Two import paths — do not mix their semantics:

| Path | Entry | Progress | History | Flags |
| ---- | ----- | -------- | ------- | ----- |
| Manual Import | `importProgressData()` via Settings | overwrite by `neet_id` | insert missing | **replace** all local flags when `problemFlags` is present |
| Auto-sync | `performAutoImport()` in `src/main/index.ts` | per-problem if imported `last_reviewed_at` is newer | insert missing | **union** incoming 1s (`mergeProblemFlags`); does not unstar/unblock |

Older backups omit `problemFlags` / `reviewHistory` — leave local flags/history untouched.

Auto-export **pulls before push** (`performAutoImport()` then `buildExportData()`). Star/block/review all call `maybeAutoExport()` from the renderer.

When changing sync: update export + **both** import paths, types in `src/preload/index.d.ts`, and `EXPORT_VERSION` if the shape changes.

## Electron Architecture

- Main owns tray, popup, SQLite, auto-updater, global shortcut, auto-sync timers.
- Renderer is a Svelte 5 popup. No SvelteKit router — `App.svelte` switches `home` / `problem`.
- Preload exposes `window.api`. Never use `ipcRenderer` from Svelte files.
- `better-sqlite3` is native; listed in `asarUnpack` in `electron-builder.yml`.

### IPC checklist (all four, always)

1. `src/main/ipc.ts` — `ipcMain.handle('channel', …)`
2. `src/preload/index.ts` — `api.method = (args) => ipcRenderer.invoke('channel', args)`
3. `src/preload/index.d.ts` — types on `API`
4. Renderer — `await window.api.method(args)`

### Database migrations

Add columns in `runMigrations()` in `src/main/db/index.ts` via `PRAGMA table_info()`. Do not edit `SCHEMA` only — existing installs never re-run `CREATE TABLE`.

## Toolchain Quirks

- **Tailwind CSS 4** uses `@tailwindcss/vite` (no PostCSS config)
- **Renderer TS**: `tsconfig.web.json` has `strict: false` and `verbatimModuleSyntax: true` → type-only imports need `import type`
- **`src/preload/index.d.ts`** is in `tsconfig.web.json` — renderer can import those types directly
- **Stores vs components**: `stores/*.ts` use classic `writable`/`derived`; `.svelte` files use Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`)
- **Node for local typecheck**: Electron/native modules expect Node 22 (CI). Node 26 cannot rebuild `better-sqlite3`

## Code Style

Prettier: no semicolons, single quotes, no trailing commas, 100-char line width (`.prettierrc.yaml`).

Imports in three groups, blank line between: Electron/node → third-party → local.

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Files/directories | kebab-case | `src/main/lib/cir.ts` |
| Svelte components | PascalCase | `HomeView.svelte` |
| Variables/functions | camelCase | `loadProblems` |
| Constants | SCREAMING_SNAKE_CASE | `POPUP_WIDTH` |
| Types/interfaces | PascalCase | `Problem`, `ExportData` |

- Explicit types on function params and return values
- Prefer interfaces over type aliases for object shapes
- Shared types go in `src/preload/index.d.ts`
- No comments unless asked
- try/catch with `console.error` and fallback return values

### Svelte 5 (runes only in components)

```svelte
<script lang="ts">
  interface Props { problem: Problem; onBack: () => void }
  let { problem, onBack }: Props = $props()

  let isSubmitting = $state(false)
  const categories = $derived(JSON.parse(problem.categories || '[]') as string[])
  $effect(() => { /* side effects */ })
</script>
```

## Release

- Default branch: `master`
- CI (`.github/workflows/ci.yml`): typecheck + `electron-vite build` on push/PR
- Release (`.github/workflows/release.yml`): push tag `v*` (e.g. `v2.0.7`)
  - CI runs `npm version` from the tag, `pnpm build:mac`, GitHub Release with dmg/zip
- Do not bump `package.json` version in git; the tag is the source of truth
- electron-builder publishes to `Tomlord1122/cometode`; auto-updater reads GitHub releases

## Common Pitfalls

1. No semicolons — Prettier strips them
2. Svelte 5 runes in components — not `$:` or implicit `let` reactivity
3. New IPC without `src/preload/index.d.ts` will not typecheck in the renderer
4. New DB columns belong in `runMigrations()`, not only `SCHEMA`
5. Star/block are on `problems`; forgetting `problemFlags` in auto-import drops them on sync
6. Manual import **replaces** flags; auto-import **unions** 1s (unstarring does not propagate via folder sync)
7. `verbatimModuleSyntax` — `import type` for type-only imports
8. Do not call CIR through `sm2.ts`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cometode** (338 symbols, 515 relationships, 17 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cometode/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cometode/clusters` | All functional areas |
| `gitnexus://repo/cometode/processes` | All execution flows |
| `gitnexus://repo/cometode/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
