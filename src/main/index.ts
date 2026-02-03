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
import path from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { initDatabase, closeDatabase, getDatabase } from './db'
import { setupIPC } from './ipc'

let popupWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastNotificationDate: string | null = null
let currentShortcut: string = 'CommandOrControl+Shift+M'
let updateReady: boolean = false
let isQuitting: boolean = false
let updateInfo: { version: string; progress: number } | null = null
let lastAutoExportDate: string | null = null

const POPUP_WIDTH = 360
const POPUP_HEIGHT = 520
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+M'

/**
 * Centralized function for performing quit-and-install with proper error handling,
 * fallback mechanism, and timing to prevent race conditions.
 */
function performQuitAndInstall(): void {
  isQuitting = true

  // Destroy the popup window first to ensure clean shutdown
  if (popupWindow) {
    popupWindow.destroy()
    popupWindow = null
  }

  try {
    // Use isSilent=false so users can see installer dialogs/errors
    // Use isForceRunAfter=true to restart app after update
    autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    console.error('quitAndInstall failed:', error)
    // Show error notification to user
    const notification = new Notification({
      title: 'Update Failed',
      body: 'Failed to install update. Please try again or download manually.',
      icon: icon
    })
    notification.show()
    isQuitting = false
    return
  }

  // Fallback: if quitAndInstall doesn't exit the app within 2 seconds, force quit
  // This handles edge cases where the updater hangs or fails silently
  setTimeout(() => {
    console.warn('quitAndInstall did not exit app, forcing quit...')
    app.quit()
  }, 2000)
}

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

  // Prevent Cmd+W from destroying the window - just hide it instead
  popupWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      popupWindow?.hide()
    }
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
  tray.setToolTip('Cometode')

  tray.on('click', () => {
    togglePopup()
  })

  tray.on('right-click', () => {
    updateTrayMenu()
    tray?.popUpContextMenu()
  })
}

function updateTrayMenu(): void {
  const menuItems: Electron.MenuItemConstructorOptions[] = []

  if (updateReady) {
    menuItems.push({
      label: '🔄 Restart to Update',
      click: () => {
        performQuitAndInstall()
      }
    })
    menuItems.push({ type: 'separator' })
  }

  menuItems.push({
    label: 'Quit',
    click: () => {
      if (updateReady) {
        performQuitAndInstall()
      } else {
        isQuitting = true
        if (popupWindow) {
          popupWindow.destroy()
          popupWindow = null
        }
        app.quit()
      }
    }
  })

  const contextMenu = Menu.buildFromTemplate(menuItems)
  tray?.setContextMenu(contextMenu)
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

  ipcMain.handle('check-for-updates', async () => {
    if (is.dev) {
      return {
        checking: false,
        updateReady: false,
        message: 'Updates are disabled in development mode'
      }
    }
    try {
      await autoUpdater.checkForUpdatesAndNotify()
      return {
        checking: true,
        updateReady,
        message: updateReady ? 'Update ready to install' : 'Checking for updates...'
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      return { checking: false, updateReady: false, message: 'Failed to check for updates' }
    }
  })

  ipcMain.handle('get-update-status', () => {
    return {
      updateReady,
      updateInfo,
      currentVersion: app.getVersion()
    }
  })

  ipcMain.handle('install-update', () => {
    if (updateReady) {
      // Use setTimeout to ensure IPC response is sent before quitting
      // 300ms gives enough time for the response to reach the renderer
      setTimeout(() => {
        performQuitAndInstall()
      }, 300)
      return { success: true }
    }
    return { success: false }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.tomlord.cometode')

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
  setInterval(
    () => {
      checkAndShowNotification()
    },
    60 * 60 * 1000
  )

  // Auto-sync: Check for import on startup (after a short delay to ensure UI is ready)
  setTimeout(() => {
    performAutoImportOnStartup()
  }, 2000)

  // Auto-sync: Check for daily export on startup and every hour
  setTimeout(() => {
    checkAndPerformAutoExport()
  }, 5000)

  setInterval(
    () => {
      checkAndPerformAutoExport()
    },
    60 * 60 * 1000
  )

  // Setup auto-updater (only in production)
  if (!is.dev) {
    setupAutoUpdater()
  }

  app.on('activate', () => {
    togglePopup()
  })
})

// Auto-updater setup
function setupAutoUpdater(): void {
  // Check for updates silently
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    updateInfo = { version: info.version, progress: 0 }
    const notification = new Notification({
      title: 'Update Available',
      body: `Cometode v${info.version} is available. Downloading...`,
      icon: icon
    })
    notification.show()
  })

  autoUpdater.on('download-progress', (progress) => {
    if (updateInfo) {
      updateInfo.progress = Math.round(progress.percent)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true
    if (updateInfo) {
      updateInfo.progress = 100
    }
    updateTrayMenu()

    const notification = new Notification({
      title: 'Update Ready',
      body: `Cometode v${info.version} is ready. Right-click tray icon to install.`,
      icon: icon
    })
    notification.on('click', () => {
      performQuitAndInstall()
    })
    notification.show()
  })

  autoUpdater.on('update-not-available', () => {
    updateInfo = null
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error)
    updateInfo = null
  })

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify()

  // Check for updates every 4 hours
  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify()
    },
    4 * 60 * 60 * 1000
  )
}

// ===== Auto-Sync Functions =====

interface ExportData {
  version: string
  exportDate: string
  appVersion: string
  progress: unknown[]
}

function getAutoSyncPreferences(): { enabled: boolean; folderPath: string | null } {
  try {
    const db = getDatabase()
    const enabled = db
      .prepare('SELECT value FROM preferences WHERE key = ?')
      .get('sync_enabled') as { value: string } | undefined
    const folderPath = db
      .prepare('SELECT value FROM preferences WHERE key = ?')
      .get('sync_folder_path') as { value: string } | undefined

    return {
      enabled: enabled?.value === 'true',
      folderPath: folderPath?.value || null
    }
  } catch (error) {
    console.error('Failed to get auto-sync preferences:', error)
    return { enabled: false, folderPath: null }
  }
}

function performAutoExport(folderPath: string): boolean {
  try {
    const db = getDatabase()

    // Get export data
    const progress = db
      .prepare(
        `
      SELECT
        p.neet_id,
        pp.status,
        pp.repetitions,
        pp.interval,
        pp.ease_factor,
        pp.next_review_date,
        pp.first_learned_at,
        pp.last_reviewed_at,
        pp.total_reviews
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE pp.total_reviews > 0
      ORDER BY p.neet_id
    `
      )
      .all()

    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: app.getVersion(),
      progress
    }

    const filePath = path.join(folderPath, 'cometode-progress.json')
    writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')

    // Update last export date
    db.prepare(
      `
      INSERT INTO preferences (key, value, updated_at)
      VALUES ('last_export_date', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `
    ).run(new Date().toISOString())

    console.log(`Auto-export completed: ${progress.length} problems exported to ${filePath}`)
    return true
  } catch (error) {
    console.error('Auto-export failed:', error)
    return false
  }
}

function checkAndPerformAutoExport(): void {
  const today = new Date().toISOString().split('T')[0]

  // Only export once per day
  if (lastAutoExportDate === today) {
    return
  }

  const { enabled, folderPath } = getAutoSyncPreferences()

  if (!enabled || !folderPath) {
    return
  }

  // Check if folder exists
  if (!existsSync(folderPath)) {
    console.warn(`Auto-sync folder does not exist: ${folderPath}`)
    return
  }

  if (performAutoExport(folderPath)) {
    lastAutoExportDate = today
  }
}

function performAutoImportOnStartup(): void {
  try {
    const { enabled, folderPath } = getAutoSyncPreferences()

    if (!enabled || !folderPath) {
      return
    }

    const filePath = path.join(folderPath, 'cometode-progress.json')

    // Check if file exists
    if (!existsSync(filePath)) {
      console.log('Auto-import: No sync file found, skipping')
      return
    }

    // Read export file
    const content = readFileSync(filePath, 'utf-8')
    const exportData = JSON.parse(content) as ExportData

    if (!exportData.exportDate || !exportData.progress) {
      console.warn('Auto-import: Invalid file format')
      return
    }

    const exportDate = new Date(exportData.exportDate)

    // Get max last_reviewed_at from DB
    const db = getDatabase()
    const maxReview = db
      .prepare('SELECT MAX(last_reviewed_at) as max_date FROM problem_progress')
      .get() as { max_date: string | null }

    const maxLocalDate = maxReview.max_date ? new Date(maxReview.max_date) : null

    // Compare dates - import if export is newer
    const shouldImport = !maxLocalDate || exportDate > maxLocalDate

    if (!shouldImport) {
      console.log('Auto-import: Local data is up to date, skipping')
      return
    }

    console.log(`Auto-import: Importing data from ${exportData.exportDate}`)

    // Perform import using transaction
    let importedCount = 0

    const transaction = db.transaction(() => {
      for (const entry of exportData.progress as {
        neet_id: number
        status: string
        repetitions: number
        interval: number
        ease_factor: number
        next_review_date: string | null
        first_learned_at: string | null
        last_reviewed_at: string | null
        total_reviews: number
      }[]) {
        const problem = db
          .prepare('SELECT id FROM problems WHERE neet_id = ?')
          .get(entry.neet_id) as { id: number } | undefined

        if (!problem) continue

        db.prepare(
          `
          INSERT INTO problem_progress
          (problem_id, status, repetitions, interval, ease_factor, next_review_date, first_learned_at, last_reviewed_at, total_reviews)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(problem_id) DO UPDATE SET
            status = excluded.status,
            repetitions = excluded.repetitions,
            interval = excluded.interval,
            ease_factor = excluded.ease_factor,
            next_review_date = excluded.next_review_date,
            first_learned_at = excluded.first_learned_at,
            last_reviewed_at = excluded.last_reviewed_at,
            total_reviews = excluded.total_reviews
        `
        ).run(
          problem.id,
          entry.status,
          entry.repetitions,
          entry.interval,
          entry.ease_factor,
          entry.next_review_date,
          entry.first_learned_at,
          entry.last_reviewed_at,
          entry.total_reviews
        )

        importedCount++
      }

      // Update last import date
      db.prepare(
        `
        INSERT INTO preferences (key, value, updated_at)
        VALUES ('last_import_date', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
      ).run(new Date().toISOString())
    })

    transaction()

    console.log(`Auto-import completed: ${importedCount} problems imported`)

    // Show notification
    const notification = new Notification({
      title: 'Cometode Sync',
      body: `Imported ${importedCount} problems from sync folder`,
      icon: icon
    })
    notification.show()
  } catch (error) {
    console.error('Auto-import failed:', error)
  }
}

// Set flag before quitting to allow window to close
app.on('before-quit', () => {
  isQuitting = true
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
