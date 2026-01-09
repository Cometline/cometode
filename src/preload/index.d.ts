import { ElectronAPI } from '@electron-toolkit/preload'

export interface Problem {
  id: number
  neet_id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  categories: string
  tags: string
  leetcode_url: string
  neetcode_url: string
  status: 'new' | 'learning' | 'reviewing'
  repetitions: number
  interval: number
  ease_factor: number
  next_review_date: string | null
  total_reviews: number
  last_reviewed_at: string | null
}

export interface ProblemFilters {
  difficulty?: string
  category?: string
  status?: string
  searchText?: string
  dueOnly?: boolean
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

export interface API {
  getProblems: (filters?: ProblemFilters) => Promise<Problem[]>
  getProblem: (problemId: number) => Promise<Problem | null>
  getTodayReviews: () => Promise<Problem[]>
  startProblem: (problemId: number) => Promise<{ success: boolean }>
  submitReview: (data: { problemId: number; quality: number }) => Promise<ReviewResult>
  getStats: () => Promise<Stats>
  getCategories: () => Promise<string[]>
  savePreference: (data: { key: string; value: string }) => Promise<{ success: boolean }>
  getPreference: (key: string) => Promise<string | null>
  resetAllProgress: () => Promise<{ success: boolean }>
  hidePopup: () => Promise<{ success: boolean }>
  getShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<{ success: boolean; shortcut: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
