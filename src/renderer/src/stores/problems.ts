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
  difficulty: '',
  category: '',
  status: '',
  searchText: '',
  dueOnly: false,
  problemSet: 'neetcode150'
})

// UI filter state (persists across view changes)
export const filterUIState = writable<{
  searchText: string
  selectedDifficulty: string | null
  showDueOnly: boolean
  showFilterMenu: boolean
}>({
  searchText: '',
  selectedDifficulty: null,
  showDueOnly: false,
  showFilterMenu: false
})

// All problems
export const problems = writable<Problem[]>([])

// Selected problem
export const selectedProblem = writable<Problem | null>(null)

// Today's due reviews
export const todayReviews = writable<Problem[]>([])

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
    const data = await window.api.getTodayReviews()
    todayReviews.set(data)
  } catch (error) {
    console.error('Failed to load today reviews:', error)
  }
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
