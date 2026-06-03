import { writable, derived } from 'svelte/store'
import type { Problem, ProblemFilters, ProblemSet } from '../../../preload/index.d'

// Problem set preference
export const currentProblemSet = writable<ProblemSet>('neetcode150')

// Initialize problem set from preferences
export async function initProblemSet(): Promise<void> {
  try {
    const saved = await window.api.getPreference('problemSet')
    if (saved === 'neetcode150' || saved === 'google' || saved === 'all') {
      currentProblemSet.set(saved)
    }
  } catch (error) {
    console.error('Failed to load problem set preference:', error)
  }
}

// Save problem set preference
export async function setProblemSet(set: ProblemSet): Promise<void> {
  currentProblemSet.set(set)
  await window.api.savePreference({ key: 'problemSet', value: set })
}

// Current filters
export const filters = writable<ProblemFilters>({
  difficulty: [],
  category: '',
  status: '',
  searchText: '',
  dueOnly: false,
  problemSet: 'neetcode150'
})

// UI filter state (persists across view changes)
export const filterUIState = writable<{
  searchText: string
  selectedDifficulties: string[]
  showDueOnly: boolean
  showFilterMenu: boolean
}>({
  searchText: '',
  selectedDifficulties: [],
  showDueOnly: false,
  showFilterMenu: false
})

// All problems
export const problems = writable<Problem[]>([])

// Selected problem
export const selectedProblem = writable<Problem | null>(null)

// Today's due review (only 1 at a time)
export const todayReview = writable<Problem | null>(null)

// Today's total review count
export const todayReviewsCount = writable<number>(0)

// Track if current problem is from review queue (for session counting)
export const isReviewQueueProblem = writable<boolean>(false)

// Completed reviews in current session (persists until app restart or manual reset)
export const completedInSession = writable<number>(0)

// Track the date when the current session started (for auto-reset on new day)
let sessionDate: string | null = null

// Daily review count preference
export const MIN_DAILY_REVIEW_COUNT = 1
export const MAX_DAILY_REVIEW_COUNT = 10
export const DEFAULT_DAILY_REVIEW_COUNT = 5
export const dailyReviewCount = writable<number>(DEFAULT_DAILY_REVIEW_COUNT)

function clampDailyReviewCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_DAILY_REVIEW_COUNT
  return Math.min(MAX_DAILY_REVIEW_COUNT, Math.max(MIN_DAILY_REVIEW_COUNT, Math.round(count)))
}

export async function initDailyReviewCount(): Promise<void> {
  try {
    const saved = await window.api.getPreference('dailyReviewCount')
    if (saved !== null) {
      dailyReviewCount.set(clampDailyReviewCount(Number(saved)))
    }
  } catch (error) {
    console.error('Failed to load daily review count preference:', error)
  }
}

export async function setDailyReviewCount(count: number): Promise<void> {
  const clamped = clampDailyReviewCount(count)
  dailyReviewCount.set(clamped)
  await window.api.savePreference({ key: 'dailyReviewCount', value: String(clamped) })
}

// Get today's date string in local timezone (YYYY-MM-DD)
function getLocalDateString(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

// Check if session should be reset (new day started)
function checkAndResetSessionIfNewDay(): boolean {
  const today = getLocalDateString()
  if (sessionDate !== today) {
    sessionDate = today
    completedInSession.set(0)
    return true
  }
  return false
}

// Categories
export const categories = writable<string[]>([])

// Loading state
export const isLoading = writable(false)

// Derived: filtered problems count
export const problemCounts = derived(problems, ($problems) => {
  const total = $problems.length
  const practiced = $problems.filter((p) => p.total_reviews > 0).length
  const mastered = $problems.filter((p) => p.repetitions >= 3).length

  return { total, practiced, mastered }
})

// Actions
export async function loadProblems(currentFilters?: ProblemFilters): Promise<void> {
  isLoading.set(true)
  try {
    // If no filters passed, get from store
    if (!currentFilters) {
      filters.subscribe((f) => (currentFilters = f))()
    }

    const data = await window.api.getProblems(currentFilters)
    problems.set(data)
  } catch (error) {
    console.error('Failed to load problems:', error)
  } finally {
    isLoading.set(false)
  }
}

export async function loadTodayReviews(): Promise<void> {
  try {
    // Auto-reset session if a new day has started
    checkAndResetSessionIfNewDay()

    const data = await window.api.getTodayReviews()
    const count = await window.api.getTodayReviewsCount()
    todayReview.set(data.length > 0 ? data[0] : null)
    todayReviewsCount.set(count)
  } catch (error) {
    console.error('Failed to load today reviews:', error)
  }
}

export async function loadMoreReviews(): Promise<void> {
  // Reset completed count to allow 5 more reviews
  completedInSession.set(0)
  await loadTodayReviews()
}

export function markReviewCompleted(): void {
  // Only increment session count if this was a review queue problem
  let isFromQueue = false
  isReviewQueueProblem.subscribe((v) => (isFromQueue = v))()

  if (isFromQueue) {
    completedInSession.update((count) => count + 1)
    todayReview.set(null)
  }

  // Always reset the flag after review
  isReviewQueueProblem.set(false)
}

export async function loadCategories(): Promise<void> {
  try {
    const data = await window.api.getCategories()
    categories.set(data)
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

export async function selectProblem(problem: Problem): Promise<void> {
  selectedProblem.set(problem)
}

export async function submitReview(
  problemId: number,
  quality: number
): Promise<{ success: boolean; nextReviewDate: string; newInterval: number }> {
  try {
    const result = await window.api.submitReview({ problemId, quality })

    // Trigger auto-export if enabled
    if (result.success) {
      try {
        const syncPrefs = await window.api.getAutoSyncPreferences()
        if (syncPrefs.enabled && syncPrefs.folderPath) {
          await window.api.performAutoExport(syncPrefs.folderPath)
        }
      } catch (syncError) {
        // Don't fail the review if sync fails
        console.error('Auto-sync after review failed:', syncError)
      }
    }

    return result
  } catch (error) {
    console.error('Failed to submit review:', error)
    return { success: false, nextReviewDate: '', newInterval: 0 }
  }
}

export async function startProblem(problemId: number): Promise<void> {
  try {
    await window.api.startProblem(problemId)
    await loadProblems()
    await loadTodayReviews()
  } catch (error) {
    console.error('Failed to start problem:', error)
  }
}
