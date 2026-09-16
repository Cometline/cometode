import { writable, derived, get } from 'svelte/store'
import type { Problem, ProblemFilters, ProblemSet } from '../../../preload/index.d'

interface FilterUIState {
  searchText: string
  selectedDifficulties: string[]
  showDueOnly: boolean
  showFilterMenu: boolean
}

const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const VALID_PROBLEM_SETS: ProblemSet[] = [
  'neetcode150',
  'google',
  'amazon',
  'meta',
  'microsoft',
  'starred',
  'all'
]

const DEFAULT_FILTER_UI_STATE: FilterUIState = {
  searchText: '',
  selectedDifficulties: [],
  showDueOnly: false,
  showFilterMenu: false
}

// Problem set preference
export const currentProblemSet = writable<ProblemSet>('neetcode150')

// Initialize problem set from preferences
export async function initProblemSet(): Promise<void> {
  try {
    const saved = await window.api.getPreference('problemSet')
    if (VALID_PROBLEM_SETS.includes(saved as ProblemSet)) {
      currentProblemSet.set(saved as ProblemSet)
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
  problemSet: 'neetcode150',
  reviewedOn: undefined
})

// UI filter state (persists across view changes)
export const filterUIState = writable<FilterUIState>(DEFAULT_FILTER_UI_STATE)

function normalizeFilterUIState(value: unknown): FilterUIState {
  if (!value || typeof value !== 'object') return DEFAULT_FILTER_UI_STATE

  const parsed = value as Partial<FilterUIState>
  const selectedDifficulties = Array.isArray(parsed.selectedDifficulties)
    ? parsed.selectedDifficulties.filter((difficulty) => VALID_DIFFICULTIES.includes(difficulty))
    : []

  return {
    searchText: typeof parsed.searchText === 'string' ? parsed.searchText : '',
    selectedDifficulties,
    showDueOnly: parsed.showDueOnly === true,
    showFilterMenu: false
  }
}

export async function initFilterUIState(): Promise<FilterUIState> {
  try {
    const saved = await window.api.getPreference('filterUIState')
    if (saved !== null) {
      const state = normalizeFilterUIState(JSON.parse(saved))
      filterUIState.set(state)
      return state
    }
  } catch (error) {
    console.error('Failed to load filter preference:', error)
  }

  filterUIState.set(DEFAULT_FILTER_UI_STATE)
  return DEFAULT_FILTER_UI_STATE
}

export async function setFilterUIState(state: FilterUIState): Promise<void> {
  const normalized = normalizeFilterUIState(state)
  filterUIState.set({ ...normalized, showFilterMenu: state.showFilterMenu })
  await window.api.savePreference({
    key: 'filterUIState',
    value: JSON.stringify({
      searchText: normalized.searchText,
      selectedDifficulties: normalized.selectedDifficulties,
      showDueOnly: normalized.showDueOnly
    })
  })
}

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

const inFlightBlockToggles = new Set<number>()
const inFlightStarToggles = new Set<number>()
const localFlagOverrides = new Map<number, { blocked?: number; starred?: number }>()
let flagEpoch = 0
let loadGeneration = 0
let toggleIdleWaiters: Array<() => void> = []

function sortProblems(list: Problem[]): Problem[] {
  return [...list].sort((a, b) => {
    const blockedA = a.blocked ? 1 : 0
    const blockedB = b.blocked ? 1 : 0
    if (blockedA !== blockedB) return blockedA - blockedB

    const reviewGroup = (p: Problem): number => {
      if ((p.total_reviews ?? 0) === 0) return 0
      if (p.status === 'reviewing') return 2
      return 1
    }
    const groupA = reviewGroup(a)
    const groupB = reviewGroup(b)
    if (groupA !== groupB) return groupA - groupB
    return a.neet_id - b.neet_id
  })
}

function applyFlagOverrides(list: Problem[]): Problem[] {
  if (localFlagOverrides.size === 0) return list
  return list.map((problem) => {
    const override = localFlagOverrides.get(problem.id)
    return override ? { ...problem, ...override } : problem
  })
}

function filterByActiveFlags(list: Problem[], currentFilters?: ProblemFilters): Problem[] {
  const active = currentFilters ?? get(filters)
  let next = list
  if (active.problemSet === 'starred') {
    next = next.filter((problem) => problem.starred === 1)
  }
  if (active.dueOnly) {
    next = next.filter((problem) => !problem.blocked)
  }
  return next
}

function notifyToggleIdle(): void {
  if (inFlightBlockToggles.size > 0 || inFlightStarToggles.size > 0) return
  const waiters = toggleIdleWaiters
  toggleIdleWaiters = []
  for (const resolve of waiters) resolve()
}

function waitForToggleIdle(): Promise<void> {
  if (inFlightBlockToggles.size === 0 && inFlightStarToggles.size === 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    toggleIdleWaiters.push(resolve)
  })
}

function patchProblemLocalFlags(
  problemId: number,
  patch: { blocked?: number; starred?: number }
): void {
  flagEpoch++
  const prev = localFlagOverrides.get(problemId)
  localFlagOverrides.set(problemId, { ...prev, ...patch })

  const apply = (problem: Problem | null): Problem | null =>
    problem && problem.id === problemId ? { ...problem, ...patch } : problem

  problems.update((list) => {
    const next = list.map((problem) =>
      problem.id === problemId ? { ...problem, ...patch } : problem
    )
    return sortProblems(filterByActiveFlags(next))
  })
  selectedProblem.update(apply)
  todayReview.update(apply)
}

// Derived: filtered problems count
export const problemCounts = derived(problems, ($problems) => {
  const total = $problems.length
  const practiced = $problems.filter((p) => p.total_reviews > 0).length
  const mastered = $problems.filter((p) => p.repetitions >= 3).length

  return { total, practiced, mastered }
})

// Actions
export async function loadProblems(currentFilters?: ProblemFilters): Promise<void> {
  const gen = ++loadGeneration
  const epochAtStart = flagEpoch
  isLoading.set(true)
  try {
    const activeFilters = currentFilters ?? get(filters)
    const data = await window.api.getProblems(activeFilters)
    if (gen !== loadGeneration) return

    problems.set(sortProblems(filterByActiveFlags(applyFlagOverrides(data), activeFilters)))

    if (
      inFlightBlockToggles.size === 0 &&
      inFlightStarToggles.size === 0 &&
      flagEpoch === epochAtStart
    ) {
      localFlagOverrides.clear()
    }
  } catch (error) {
    console.error('Failed to load problems:', error)
  } finally {
    if (gen === loadGeneration) isLoading.set(false)
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
  // Reset completed count to allow another daily quota of reviews
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

let reloadTail: Promise<void> = Promise.resolve()
let reloadQueued = false

async function coalesceTodayReviewsReload(): Promise<void> {
  reloadQueued = true

  const run = async (): Promise<void> => {
    while (reloadQueued) {
      reloadQueued = false
      await loadTodayReviews()
    }
  }

  reloadTail = reloadTail.then(run, run)
  await reloadTail
}

let exportTail: Promise<void> = Promise.resolve()
let exportQueued = false
let exportReason = ''

async function maybeAutoExport(reason: string): Promise<void> {
  exportReason = reason
  exportQueued = true

  const run = async (): Promise<void> => {
    while (exportQueued || inFlightBlockToggles.size > 0 || inFlightStarToggles.size > 0) {
      await waitForToggleIdle()
      if (!exportQueued) break
      exportQueued = false
      const currentReason = exportReason
      try {
        const syncPrefs = await window.api.getAutoSyncPreferences()
        if (syncPrefs.enabled && syncPrefs.folderPath) {
          await window.api.performAutoExport(syncPrefs.folderPath)
        }
      } catch (syncError) {
        console.error(`Auto-sync after ${currentReason} failed:`, syncError)
      }
    }
  }

  exportTail = exportTail.then(run, run)
  await exportTail
}

export async function submitReview(
  problemId: number,
  quality: number
): Promise<{ success: boolean; nextReviewDate: string; newInterval: number }> {
  try {
    const result = await window.api.submitReview({ problemId, quality })

    if (result.success) {
      await maybeAutoExport('review')
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

export async function setProblemBlocked(problemId: number, blocked: boolean): Promise<void> {
  if (inFlightBlockToggles.has(problemId)) return
  inFlightBlockToggles.add(problemId)

  try {
    const result = await window.api.setProblemBlocked(problemId, blocked)
    if (!result.success) return

    patchProblemLocalFlags(problemId, { blocked: blocked ? 1 : 0 })
  } catch (error) {
    console.error('Failed to set problem blocked:', error)
    return
  } finally {
    inFlightBlockToggles.delete(problemId)
    notifyToggleIdle()
  }

  await coalesceTodayReviewsReload()
  await maybeAutoExport('block')
}

export async function setProblemStarred(problemId: number, starred: boolean): Promise<void> {
  if (inFlightStarToggles.has(problemId)) return
  inFlightStarToggles.add(problemId)

  try {
    const result = await window.api.setProblemStarred(problemId, starred)
    if (!result.success) return

    patchProblemLocalFlags(problemId, { starred: starred ? 1 : 0 })
  } catch (error) {
    console.error('Failed to set problem starred:', error)
    return
  } finally {
    inFlightStarToggles.delete(problemId)
    notifyToggleIdle()
  }

  await maybeAutoExport('star')
}
