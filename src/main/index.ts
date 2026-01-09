import {
  app,
  shell,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  globalShortcut
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, closeDatabase, getDatabase } from './db'
import { setupIPC } from './ipc'

let popupWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastNotificationDate: string | null = null
let currentShortcut: string = 'CommandOrControl+Shift+N'

const POPUP_WIDTH = 360
const POPUP_HEIGHT = 520
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+N'

function createPopupWindow(): void {
  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    vibrancy: 'menu',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Hide when clicking outside
  popupWindow.on('blur', () => {
    popupWindow?.hide()
  })

  // Open external links in browser
  popupWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    popupWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    popupWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getPopupPosition(): { x: number; y: number } {
  const trayBounds = tray?.getBounds()
  if (!trayBounds) {
    return { x: 0, y: 0 }
  }

  // Position below tray icon, centered
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  return { x, y }
}

function togglePopup(): void {
  if (!popupWindow) return

  if (popupWindow.isVisible()) {
    popupWindow.hide()
  } else {
    const { x, y } = getPopupPosition()
    popupWindow.setPosition(x, y, false)
    popupWindow.show()
    popupWindow.focus()
  }
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon)
  const resizedIcon = trayIcon.resize({ width: 18, height: 18 })
  resizedIcon.setTemplateImage(true)

  tray = new Tray(resizedIcon)
  tray.setToolTip('NeetCode Tracker')

  // Right-click context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.on('click', () => {
    togglePopup()
  })

  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu)
  })
}

function registerShortcut(shortcut: string): boolean {
  // Unregister current shortcut first
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut)
  }

  // Try to register new shortcut
  try {
    const success = globalShortcut.register(shortcut, () => {
      togglePopup()
    })

    if (success) {
      currentShortcut = shortcut
      return true
    }
    return false
  } catch {
    return false
  }
}

function loadShortcutPreference(): void {
  try {
    const db = getDatabase()
    const result = db.prepare('SELECT value FROM preferences WHERE key = ?').get('shortcut') as
      | { value: string }
      | undefined

    const shortcut = result?.value || DEFAULT_SHORTCUT
    registerShortcut(shortcut)
  } catch (error) {
    console.error('Failed to load shortcut preference:', error)
    registerShortcut(DEFAULT_SHORTCUT)
  }
}

function checkAndShowNotification(): void {
  const today = new Date().toISOString().split('T')[0]

  // Only show once per day
  if (lastNotificationDate === today) {
    return
  }

  try {
    const db = getDatabase()
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM problem_progress
      WHERE DATE(next_review_date) <= DATE('now')
        AND status != 'new'
    `
      )
      .get() as { count: number }

    if (result.count > 0) {
      const notification = new Notification({
        title: 'NeetCode Tracker',
        body: `You have ${result.count} problem${result.count > 1 ? 's' : ''} due for review today!`,
        icon: icon
      })

      notification.on('click', () => {
        togglePopup()
      })

      notification.show()
      lastNotificationDate = today
    }
  } catch (error) {
    console.error('Failed to check for due reviews:', error)
  }
}

// IPC handlers for popup and shortcut
function setupPopupIPC(): void {
  ipcMain.handle('hide-popup', () => {
    popupWindow?.hide()
    return { success: true }
  })

  ipcMain.handle('get-shortcut', () => {
    return currentShortcut
  })

  ipcMain.handle('set-shortcut', (_event, shortcut: string) => {
    const success = registerShortcut(shortcut)
    if (success) {
      // Save to database
      try {
        const db = getDatabase()
        db.prepare(
          `
          INSERT INTO preferences (key, value, updated_at)
          VALUES ('shortcut', ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `
        ).run(shortcut)
      } catch (error) {
        console.error('Failed to save shortcut preference:', error)
      }
    }
    return { success, shortcut: currentShortcut }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.tomlord.comet-neetcode')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Hide dock icon - this is a menu bar only app
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  // Initialize database
  const db = initDatabase()

  // Setup IPC handlers
  setupIPC(db)
  setupPopupIPC()

  // Create popup window and tray
  createPopupWindow()
  createTray()

  // Load and register keyboard shortcut
  loadShortcutPreference()

  // Check for due reviews and show notification
  setTimeout(() => {
    checkAndShowNotification()
  }, 3000)

  // Check every hour for due reviews
  setInterval(() => {
    checkAndShowNotification()
  }, 60 * 60 * 1000)

  app.on('activate', () => {
    togglePopup()
  })
})

// Don't quit when all windows are closed - this is a menu bar app
app.on('window-all-closed', () => {
  // Do nothing - keep running
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
  closeDatabase()
})
