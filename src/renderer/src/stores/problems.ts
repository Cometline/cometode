import { writable, derived } from 'svelte/store'
import type { Problem, ProblemFilters } from '../../../preload/index.d'

// Current filters
export const filters = writable<ProblemFilters>({
  difficulty: '',
  category: '',
  status: '',
  searchText: '',
  dueOnly: false
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
