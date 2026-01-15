# Cometode

A lightweight macOS menu bar app for mastering **NeetCode 150** and **Google interview problems** using spaced repetition.

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white)

## What is this?

Cometode helps you systematically practice LeetCode problems using the **SM-2 spaced repetition algorithm** (the same algorithm used by Anki). Instead of randomly grinding problems, the app schedules reviews based on how well you remember each solution:

- **Forgot it?** Review again tomorrow
- **Got it easily?** See it again in a week (or longer)

The app lives in your menu bar for quick access - click the icon, review a problem, and get back to work.

## Features

- **Menu Bar App** - Click the tray icon to open a compact popup. No dock icon, no clutter.
- **Spaced Repetition** - SM-2 algorithm schedules reviews at optimal intervals
- **Multiple Problem Sets** - Switch between NeetCode 150 and Google interview problems (440+ problems)
- **Shared Progress** - Problems that appear in both sets share the same learning progress
- **Quick Review Flow** - Rate your recall: Again / Hard / Good / Easy
- **Progress Tracking** - See how many problems you've practiced and mastered
- **Daily Notifications** - Get reminded when problems are due for review
- **Dark Mode** - Automatic or manual theme switching
- **Keyboard Shortcut** - Customizable hotkey to open the app (default: `Cmd+Shift+N`)

## Installation

### Download

Download the latest release from the [Releases page](https://github.com/Tomlord1122/cometode/releases):

- **Apple Silicon (M1/M2/M3)**: `cometode-x.x.x-arm64.dmg`
- **Intel Mac**: `cometode-x.x.x-x64.dmg`

### Install

1. Open the `.dmg` file
2. Drag **Cometode** to your Applications folder
3. Launch from Applications (you may need to right-click → Open the first time)

The app will appear in your menu bar.

## Usage

### Getting Started

1. Click the comet icon in your menu bar
2. Use the toggle at the top to switch between **NeetCode 150** and **Google** problem sets
3. Browse the problem list or use search to find a specific problem
4. Click a problem to view details and open it on NeetCode
5. After solving, rate your performance: Again / Hard / Good / Easy

### Problem Sets

| Set | Problems | Description |
|-----|----------|-------------|
| NeetCode 150 | 150 | Curated list of essential coding interview problems |
| Google | 440 | Problems frequently asked in Google interviews |

**Note:** 149 problems appear in both sets. Your learning progress is shared - if you practice a problem in one set, your progress carries over to the other.

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
git clone https://github.com/Tomlord1122/cometode.git
cd cometode

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

- Problem sets from [NeetCode](https://neetcode.io/practice) (NeetCode 150 & Google company tag)
- Spaced repetition algorithm based on [SM-2](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
