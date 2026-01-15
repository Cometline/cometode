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

  getTodayReviews: () => ipcRenderer.invoke('get-today-reviews'),

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
  showSaveDialog: (defaultFileName: string) => ipcRenderer.invoke('show-save-dialog', defaultFileName),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath)
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
