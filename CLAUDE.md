# Cometode - Menu Bar App

## Overview
A macOS menu bar app for tracking NeetCode 150 problem practice using Anki-style SM-2 spaced repetition.

## Tech Stack
- Electron 39 + electron-vite 5
- Svelte 5 + TypeScript
- Tailwind CSS 4 (`@tailwindcss/vite`)
- better-sqlite3

## App Features

### Menu Bar Popup
- Click tray icon to show/hide popup (360x520px)
- Right-click tray for quit option
- Auto-hides when clicking outside
- No dock icon - runs exclusively in menu bar

### Core Features
- 150 NeetCode problems with categories/tags
- SM-2 spaced repetition algorithm
- Quality ratings: Again (0), Hard (1), Good (2), Easy (3)
- Progress tracking with due date calculations
- Daily notifications for due reviews
- Dark/Light/System theme support

## Project Structure

```
cometode/
├── src/
│   ├── main/
│   │   ├── index.ts          # Tray popup window + notifications
│   │   ├── ipc.ts            # IPC handlers
│   │   ├── db/
│   │   │   ├── index.ts      # DB schema (problems, progress, history, preferences)
│   │   │   └── seed.ts       # NeetCode 150 data import
│   │   └── lib/
│   │       └── sm2.ts        # SM-2 algorithm
│   ├── preload/
│   │   ├── index.ts          # API bridge
│   │   └── index.d.ts        # Type definitions
│   └── renderer/src/
│       ├── App.svelte        # Main app with view switching
│       ├── stores/           # Svelte stores
│       │   ├── problems.ts   # Problem data + actions
│       │   ├── stats.ts      # Statistics
│       │   └── theme.ts      # Theme preference
│       ├── components/
│       │   ├── HomeView.svelte      # Dashboard with problem list
│       │   ├── ProblemView.svelte   # Problem detail + review
│       │   └── ThemeToggle.svelte   # Theme switcher
│       └── assets/
│           └── main.css      # Tailwind + custom styles
├── resources/
│   ├── icon.png              # App icon
│   └── neetcode-150.json     # Problem data
└── package.json
```

## Database Schema

```sql
-- problems: 150 NeetCode problems
-- problem_progress: SM-2 state (repetitions, interval, ease_factor, next_review_date)
-- review_history: Audit trail of all reviews
-- preferences: User settings (theme)
```

Database location: `~/Library/Application Support/cometode/cometode.db`

## Development

```bash
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm build:mac  # Build macOS app
```

## UI Flow

1. **Home View**: Due today card + progress bar + searchable problem list
2. **Problem View**: Problem info + external links (NeetCode/LeetCode) + inline review buttons
3. Review success → auto-return to home after 1.5s

## Keyboard Shortcuts

- `1-4`: Quick rate (Again/Hard/Good/Easy) in problem view
