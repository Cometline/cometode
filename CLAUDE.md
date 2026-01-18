# Cometode - Menu Bar App

## Overview
A macOS menu bar app for tracking coding problem practice using Anki-style SM-2 spaced repetition. Supports multiple problem sets: NeetCode 150, Google interview questions, and a combined set.

## Tech Stack
- Electron 39 + electron-vite 5
- Svelte 5 + TypeScript (using runes: `$state`, `$effect`, `$derived`)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- better-sqlite3
- electron-updater (auto-updates via GitHub releases)

## App Features

### Menu Bar Popup
- Click tray icon to show/hide popup (360x520px)
- Right-click tray for quit/update options
- Auto-hides when clicking outside
- No dock icon - runs exclusively in menu bar
- Global keyboard shortcut (default: Cmd+Shift+M, customizable)

### Core Features
- 150+ coding problems with categories/tags
- Multiple problem sets: NeetCode 150, Google, All
- SM-2 spaced repetition algorithm
- Quality ratings: Again (0), Hard (1), Good (2), Easy (3)
- Progress tracking with due date calculations
- Daily notifications for due reviews
- Dark/Light/System theme support
- Export/Import progress as JSON
- Auto-sync: export after each review to user folder (Dropbox/iCloud) + auto-import on startup
- Auto-updates from GitHub releases

## Project Structure

```
cometode/
├── src/
│   ├── main/
│   │   ├── index.ts          # Tray popup + notifications + auto-updater
│   │   ├── ipc.ts            # IPC handlers (30+)
│   │   ├── db/
│   │   │   ├── index.ts      # DB schema + migrations
│   │   │   └── seed.ts       # Problem data import
│   │   └── lib/
│   │       └── sm2.ts        # SM-2 algorithm
│   ├── preload/
│   │   ├── index.ts          # API bridge (50+ handlers)
│   │   └── index.d.ts        # Type definitions
│   └── renderer/src/
│       ├── App.svelte        # Main app + settings modal + view routing
│       ├── main.ts           # Renderer entry point
│       ├── stores/
│       │   ├── problems.ts   # Problem data + filters + actions
│       │   ├── stats.ts      # Statistics
│       │   └── theme.ts      # Theme preference
│       ├── components/
│       │   ├── HomeView.svelte      # Dashboard + filters + problem list
│       │   ├── ProblemView.svelte   # Problem detail + review buttons
│       │   └── ThemeToggle.svelte   # Theme switcher
│       └── assets/
│           ├── main.css      # Tailwind + custom styles
│           └── Cometline.png # Branding logo
├── resources/
│   ├── icon.png              # App tray icon
│   ├── problems-all.json     # Complete problem database
│   ├── neetcode-150.json     # NeetCode 150 subset
│   └── neetcode-google.json  # Google interview subset
├── electron.vite.config.ts   # Build configuration
├── electron-builder.yml      # App packaging + code signing
└── package.json
```

## Database Schema

```sql
-- problems: 150+ problems with metadata (in_neetcode_150, in_google flags)
-- problem_progress: SM-2 state (repetitions, interval, ease_factor, next_review_date)
-- review_history: Audit trail of all reviews
-- preferences: User settings (theme, keyboard shortcut, problem set)
```

Database location: `~/Library/Application Support/cometode/cometode.db`

Migrations are handled automatically in `db/index.ts` for schema evolution.

## Development

```bash
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm build:mac  # Build macOS app (.dmg + .zip)
```

## UI Flow

1. **Home View**: Due today card + progress bar + multi-filter problem list
   - Filters: search, difficulty, status (new/learning/reviewing), due only
   - Problem set selector: NeetCode 150 / Google / All
2. **Problem View**: Problem info + external links (NeetCode/LeetCode) + review buttons with interval previews
3. **Settings Modal**: Keyboard shortcut, update check, export/import, auto-sync, reset progress
4. Review success → auto-return to home after 1.5s

## Keyboard Shortcuts

- `1-4`: Quick rate (Again/Hard/Good/Easy) in problem view
- `Cmd+Shift+M` (default): Toggle popup from anywhere (customizable)

## Key IPC Handlers (src/main/ipc.ts)

- `get-problems`: Filtered list with problem set support
- `submit-review`: SM-2 calculation + atomic transaction
- `get-stats`: Breakdown by difficulty, category, review history
- `export-progress` / `import-progress`: JSON backup/restore
- `get-shortcut` / `set-shortcut`: Custom keyboard shortcut
- `check-for-updates` / `install-update`: Auto-updater control
- `get-auto-sync-preferences` / `set-auto-sync-preferences`: Auto-sync settings
- `perform-auto-export` / `check-auto-import`: Sync operations

## SM-2 Algorithm (src/main/lib/sm2.ts)

- Quality 0-3 mapped to SM-2's 2-5 scale
- Initial ease factor: 2.5, minimum: 1.3
- Intervals: 1 day → 3 days → (interval × ease factor)
- "Easy" bonus: ×1.3 multiplier
- Failures reset to 1 day
