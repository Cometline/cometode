# AGENTS.md - Coding Agent Instructions

## Project Overview

Cometode is a macOS menu bar app for tracking coding problem practice using spaced repetition. Electron + Svelte 5 + TypeScript + Tailwind CSS 4 + better-sqlite3.

## Build/Lint/Test Commands

```bash
pnpm dev                 # Start dev server with hot reload
pnpm start               # Preview production build

# Type Checking
pnpm typecheck           # Full typecheck (TypeScript + Svelte)
pnpm typecheck:node      # TypeScript check for main/preload only
pnpm svelte-check        # Svelte-specific type checking

# Linting & Formatting
pnpm lint                # Run ESLint with cache
pnpm format              # Run Prettier on all files

# Building
pnpm build               # Production build (runs typecheck first)
pnpm build:mac           # Build macOS app (.dmg + .zip)
pnpm build:win           # Build Windows app
pnpm build:linux         # Build Linux app
```

### Testing

No test framework is configured. Run `pnpm typecheck` to verify changes. If adding tests: use Vitest + Playwright for E2E, place in `__tests__/` or `.test.ts` suffix.

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Tray, popup, auto-updater
│   ├── ipc.ts      # IPC handlers (30+)
│   ├── db/         # SQLite schema, migrations, seed
│   └── lib/        # CIR spaced repetition algorithm (cir.ts)
├── preload/        # Electron preload bridge
│   ├── index.ts    # API exposed to renderer
│   └── index.d.ts  # Shared types + API interface
└── renderer/src/   # Svelte frontend
    ├── App.svelte  # Main app, manual routing (no SvelteKit)
    ├── env.d.ts    # Svelte/Vite type references
    ├── stores/     # Svelte stores (problems, stats, theme)
    └── components/ # UI components
```

Build tool: **electron-vite** (not plain Vite). Config in `electron.vite.config.ts`.

## Toolchain Quirks

- **Tailwind CSS 4** uses the `@tailwindcss/vite` plugin (no PostCSS config)
- **better-sqlite3** is a native module listed in `asarUnpack` in `electron-builder.yml` — changes to the database layer may affect builds
- **TypeScript in renderer**: `tsconfig.web.json` has `strict: false` and `verbatimModuleSyntax: true`. The latter means `import type` is required for type-only imports
- **`src/preload/index.d.ts`** is included in `tsconfig.web.json` — renderer code can use its types directly
- **Database migrations** live in `runMigrations()` inside `src/main/db/index.ts` — they run on every app start, checking for columns with `PRAGMA table_info()`

## Code Style

### Formatting (Prettier)

- No semicolons, single quotes, no trailing commas, 100-char line width
- Configured in `.prettierrc.yaml`

### Import Organization

Three groups, separated by blank lines:

```typescript
// 1. Electron/external dependencies
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'

// 2. Third-party libraries
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// 3. Local modules
import { initDatabase, getDatabase } from './db'
```

### Naming Conventions

| Element             | Convention           | Example                          |
| ------------------- | -------------------- | -------------------------------- |
| Files/directories   | kebab-case           | `src/main/lib/cir.ts`            |
| Svelte components   | PascalCase           | `HomeView.svelte`                |
| Variables/functions | camelCase            | `loadProblems`, `popupWindow`    |
| Constants           | SCREAMING_SNAKE_CASE | `MAX_INTERVAL_DAYS`, `POPUP_WIDTH` |
| Types/interfaces    | PascalCase           | `Problem`, `ProblemFilters`      |

### TypeScript

- Explicit types for function parameters and return types
- Prefer interfaces over type aliases for object shapes
- Export shared types from `src/preload/index.d.ts`

### Svelte 5 (Runes Only)

```svelte
<script lang="ts">
  interface Props { problem: Problem; onBack: () => void }
  let { problem, onBack }: Props = $props()

  let isSubmitting = $state(false)
  const categories = $derived(JSON.parse(problem.categories || '[]') as string[])
  $effect(() => { /* side effects */ })
</script>
```

### IPC Pattern

1. **Main** (`src/main/ipc.ts`): `ipcMain.handle('channel', handler)`
2. **Preload** (`src/preload/index.ts`): `api.method = (args) => ipcRenderer.invoke('channel', args)`
3. **Renderer**: `await window.api.method(args)`
4. **Types**: Always add new IPC methods and their types to `src/preload/index.d.ts`

### Error Handling

Use try-catch with `console.error` and return fallback values.

## Common Pitfalls

1. **No semicolons** — Prettier will remove them
2. **Use Svelte 5 runes** — not legacy `$:` or `let x = ...` reactivity
3. **Type all IPC data** — add types to `src/preload/index.d.ts`
4. **Database migrations** — add via `runMigrations()` in `src/main/db/index.ts`, not by editing the schema directly
5. **No test files exist** — verify with `pnpm typecheck` instead
6. **`verbatimModuleSyntax` in renderer** — use `import type` for type-only imports
