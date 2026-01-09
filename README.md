# Comet NeetCode

A lightweight macOS menu bar app for mastering the **NeetCode 150** problem set using spaced repetition.

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white)

## What is this?

Comet NeetCode helps you systematically practice LeetCode problems using the **SM-2 spaced repetition algorithm** (the same algorithm used by Anki). Instead of randomly grinding problems, the app schedules reviews based on how well you remember each solution:

- **Forgot it?** Review again tomorrow
- **Got it easily?** See it again in a week (or longer)

The app lives in your menu bar for quick access - click the icon, review a problem, and get back to work.

## Features

- **Menu Bar App** - Click the tray icon to open a compact popup. No dock icon, no clutter.
- **Spaced Repetition** - SM-2 algorithm schedules reviews at optimal intervals
- **150 NeetCode Problems** - All problems pre-loaded with categories and difficulty
- **Quick Review Flow** - Rate your recall: Again / Hard / Good / Easy
- **Progress Tracking** - See how many problems you've practiced and mastered
- **Daily Notifications** - Get reminded when problems are due for review
- **Dark Mode** - Automatic or manual theme switching
- **Keyboard Shortcut** - Customizable hotkey to open the app (default: `Cmd+Shift+N`)

## Installation

### Download

Download the latest release from the [Releases page](https://github.com/Tomlord1122/comet-neetcode/releases):

- **Apple Silicon (M1/M2/M3)**: `comet-neetcode-x.x.x-arm64.dmg`
- **Intel Mac**: `comet-neetcode-x.x.x-x64.dmg`

### Install

1. Open the `.dmg` file
2. Drag **Comet NeetCode** to your Applications folder
3. Launch from Applications (you may need to right-click → Open the first time)

The app will appear in your menu bar.

## Usage

### Getting Started

1. Click the comet icon in your menu bar
2. Browse the problem list or use search to find a specific problem
3. Click a problem to view details
4. Click **Start Practice** to open the problem on NeetCode
5. After solving, rate your performance: Again / Hard / Good / Easy

### Review Flow

When problems are due for review, you'll see a notification. The "Due Today" card shows how many problems need review:

1. Click **Start Review** to begin
2. Solve the problem
3. Rate your recall
4. Move to the next problem or return home

### Settings

Click the gear icon to:
- Change the keyboard shortcut
- Reset all progress

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
# Clone the repo
git clone https://github.com/Tomlord1122/comet-neetcode.git
cd comet-neetcode

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Build

```bash
# Build for macOS
pnpm build:mac

# Build outputs in dist/
```

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Tray, popup window, shortcuts
│   ├── ipc.ts      # IPC handlers
│   ├── db/         # SQLite database
│   └── lib/sm2.ts  # SM-2 algorithm
├── preload/        # Electron preload scripts
└── renderer/       # Svelte frontend
    ├── App.svelte
    ├── components/
    └── stores/
```

## Tech Stack

- **Electron** - Desktop app framework
- **Svelte 5** - UI framework with runes
- **Tailwind CSS 4** - Styling
- **better-sqlite3** - Local database
- **electron-vite** - Build tooling

## How SM-2 Works

The SM-2 algorithm adjusts review intervals based on your performance:

| Rating | Meaning | Effect |
|--------|---------|--------|
| Again | Forgot completely | Reset to 1 day |
| Hard | Struggled to recall | Shorter interval |
| Good | Recalled with effort | Normal interval |
| Easy | Instant recall | Longer interval |

Each successful review increases the interval exponentially. Miss a review, and the interval resets.


## Credits

- Problem set from [NeetCode 150](https://neetcode.io/practice)
- Spaced repetition algorithm based on [SM-2](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
