import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Problem set type
type ProblemSet = 'neetcode150' | 'google' | 'all'

// Custom APIs for renderer
const api = {
  // Problems
  getProblems: (filters?: {
    difficulty?: string
    category?: string
    status?: string
    searchText?: string
    dueOnly?: boolean
    problemSet?: ProblemSet
  }) => ipcRenderer.invoke('get-problems', filters),

  getProblem: (problemId: number) => ipcRenderer.invoke('get-problem', problemId),

  getTodayReviews: (problemSet?: ProblemSet, offset?: number) =>
    ipcRenderer.invoke('get-today-reviews', problemSet, offset),

  getTodayReviewsCount: (problemSet?: ProblemSet) =>
    ipcRenderer.invoke('get-today-reviews-count', problemSet),

  getTomorrowReviews: (problemSet?: ProblemSet) =>
    ipcRenderer.invoke('get-tomorrow-reviews', problemSet),

  startProblem: (problemId: number) => ipcRenderer.invoke('start-problem', problemId),

  // Reviews
  submitReview: (data: { problemId: number; quality: number }) =>
    ipcRenderer.invoke('submit-review', data),

  // Stats
  getStats: (problemSet?: ProblemSet) => ipcRenderer.invoke('get-stats', problemSet),

  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),

  // Preferences
  savePreference: (data: { key: string; value: string }) =>
    ipcRenderer.invoke('save-preference', data),

  getPreference: (key: string) => ipcRenderer.invoke('get-preference', key),

  // Reset
  resetAllProgress: () => ipcRenderer.invoke('reset-all-progress'),

  // Popup control
  hidePopup: () => ipcRenderer.invoke('hide-popup'),

  // Shortcut
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (shortcut: string) => ipcRenderer.invoke('set-shortcut', shortcut),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Import/Export
  exportProgress: () => ipcRenderer.invoke('export-progress'),
  importProgress: (data: unknown) => ipcRenderer.invoke('import-progress', data),
  showSaveDialog: (defaultFileName: string) =>
    ipcRenderer.invoke('show-save-dialog', defaultFileName),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),

  // Auto-Sync
  getAutoSyncPreferences: () => ipcRenderer.invoke('get-auto-sync-preferences'),
  setAutoSyncPreferences: (data: { enabled: boolean; folderPath?: string }) =>
    ipcRenderer.invoke('set-auto-sync-preferences', data),
  showFolderDialog: () => ipcRenderer.invoke('show-folder-dialog'),
  performAutoExport: (folderPath: string) => ipcRenderer.invoke('perform-auto-export', folderPath),
  checkAutoImport: (folderPath: string) => ipcRenderer.invoke('check-auto-import', folderPath),
  setLastImportDate: () => ipcRenderer.invoke('set-last-import-date'),

  // Interview Mode
  getInterviewMode: () => ipcRenderer.invoke('get-interview-mode'),
  setInterviewMode: (enabled: boolean) => ipcRenderer.invoke('set-interview-mode', enabled)
}

// Expose APIs
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
