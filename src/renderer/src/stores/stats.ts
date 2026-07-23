import { writable, derived, get } from 'svelte/store'
import type { Stats, ProblemSet, ActivityEntry } from '../../../preload/index.d'
import { currentProblemSet } from './problems'

// Stats data
export const stats = writable<Stats | null>(null)

// Loading state
export const isLoadingStats = writable(false)

// Activity data (daily review counts, for contribution-style heatmap)
export const activity = writable<ActivityEntry[]>([])

// Whether the activity heatmap is visible
export const showActivityGraph = writable(true)

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive days with ≥1 review, counting back from today (or yesterday if today is empty). */
export function computeActivityStreak(entries: ActivityEntry[]): number {
  const activeDates = new Set(entries.filter((entry) => entry.count > 0).map((entry) => entry.date))
  if (activeDates.size === 0) return 0

  const today = new Date()
  const todayStr = formatLocalDate(today)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = formatLocalDate(yesterday)

  let cursor: Date
  if (activeDates.has(todayStr)) {
    cursor = today
  } else if (activeDates.has(yesterdayStr)) {
    cursor = yesterday
  } else {
    return 0
  }

  let streak = 0
  while (activeDates.has(formatLocalDate(cursor))) {
    streak++
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Current review streak derived from daily activity
export const activityStreak = derived(activity, ($activity) => computeActivityStreak($activity))

// Derived: completion percentage
export const completionPercentage = derived(stats, ($stats) => {
  if (!$stats || $stats.total === 0) return 0
  return Math.round(($stats.practiced / $stats.total) * 100)
})

// Load stats
export async function loadStats(problemSet?: ProblemSet): Promise<void> {
  isLoadingStats.set(true)
  try {
    const set = problemSet ?? get(currentProblemSet)
    const data = await window.api.getStats(set)
    stats.set(data)
  } catch (error) {
    console.error('Failed to load stats:', error)
  } finally {
    isLoadingStats.set(false)
  }
}

// Load activity
export async function loadActivity(): Promise<void> {
  try {
    activity.set(await window.api.getActivity())
  } catch (error) {
    console.error('Failed to load activity:', error)
  }
}

export async function initShowActivityGraph(): Promise<void> {
  try {
    const saved = await window.api.getPreference('showActivityGraph')
    if (saved !== null) {
      showActivityGraph.set(saved === 'true')
    }
  } catch (error) {
    console.error('Failed to load activity graph preference:', error)
  }
}

export async function setShowActivityGraph(show: boolean): Promise<void> {
  showActivityGraph.set(show)
  try {
    await window.api.savePreference({ key: 'showActivityGraph', value: String(show) })
  } catch (error) {
    console.error('Failed to save activity graph preference:', error)
  }
}
