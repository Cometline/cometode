import { ElectronAPI } from '@electron-toolkit/preload'

export type ProblemSet = 'neetcode150' | 'google' | 'all'

export interface Problem {
  id: number
  neet_id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  categories: string
  tags: string
  leetcode_url: string
  neetcode_url: string
  in_neetcode_150: number
  in_google: number
  status: 'new' | 'learning' | 'reviewing'
  repetitions: number
  interval: number
  ease_factor: number
  success_rate: number
  consecutive_successes: number
  next_review_date: string | null
  total_reviews: number
  last_reviewed_at: string | null
}

export interface ProblemFilters {
  difficulty?: string[]
  category?: string
  status?: string
  searchText?: string
  dueOnly?: boolean
  problemSet?: ProblemSet
}

export interface Stats {
  total: number
  practiced: number
  todayDue: number
  totalReviews: number
  byDifficulty: Array<{
    difficulty: string
    total: number
    practiced: number
    mastered: number
  }>
  byCategory: Array<{
    category: string
    total: number
    practiced: number
  }>
  reviewHistory: Array<{
    date: string
    count: number
  }>
}

export interface ReviewResult {
  success: boolean
  nextReviewDate: string
  newInterval: number
}

export interface ExportProgressEntry {
  neet_id: number
  status: string
  repetitions: number
  interval: number
  ease_factor: number
  next_review_date: string | null
  first_learned_at: string | null
  last_reviewed_at: string | null
  total_reviews: number
  // CIR algorithm fields (v1.1+)
  success_rate?: number
  consecutive_successes?: number
}

export interface ExportData {
  version: string
  exportDate: string
  appVersion: string
  progress: ExportProgressEntry[]
}

export interface API {
  getProblems: (filters?: ProblemFilters) => Promise<Problem[]>
  getProblem: (problemId: number) => Promise<Problem | null>
  getTodayReviews: (problemSet?: ProblemSet, offset?: number) => Promise<Problem[]>
  getTodayReviewsCount: (problemSet?: ProblemSet) => Promise<number>
  getTomorrowReviews: (problemSet?: ProblemSet) => Promise<Problem[]>
  startProblem: (problemId: number) => Promise<{ success: boolean }>
  submitReview: (data: { problemId: number; quality: number }) => Promise<ReviewResult>
  getStats: (problemSet?: ProblemSet) => Promise<Stats>
  getCategories: () => Promise<string[]>
  savePreference: (data: { key: string; value: string }) => Promise<{ success: boolean }>
  getPreference: (key: string) => Promise<string | null>
  resetAllProgress: () => Promise<{ success: boolean }>
  hidePopup: () => Promise<{ success: boolean }>
  getShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<{ success: boolean; shortcut: string }>
  checkForUpdates: () => Promise<{ checking: boolean; updateReady: boolean; message: string }>
  getUpdateStatus: () => Promise<{
    updateReady: boolean
    updateInfo: { version: string; progress: number } | null
    currentVersion: string
  }>
  installUpdate: () => Promise<{ success: boolean }>

  // Import/Export
  exportProgress: () => Promise<ExportData>
  importProgress: (
    data: ExportData
  ) => Promise<{ success: boolean; imported: number; error?: string }>
  showSaveDialog: (defaultFileName: string) => Promise<string | null>
  showOpenDialog: () => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>

  // Auto-Sync
  getAutoSyncPreferences: () => Promise<{
    enabled: boolean
    folderPath: string | null
    lastExportDate: string | null
    lastImportDate: string | null
  }>
  setAutoSyncPreferences: (data: {
    enabled: boolean
    folderPath?: string
  }) => Promise<{ success: boolean }>
  showFolderDialog: () => Promise<string | null>
  performAutoExport: (folderPath: string) => Promise<{
    success: boolean
    exportedCount?: number
    error?: string
  }>
  checkAutoImport: (folderPath: string) => Promise<{
    shouldImport: boolean
    exportDate?: string
    maxLocalDate?: string | null
    data?: ExportData | null
    reason?: string
  }>
  setLastImportDate: () => Promise<{ success: boolean }>

  // Interview Mode
  getInterviewMode: () => Promise<boolean>
  setInterviewMode: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
