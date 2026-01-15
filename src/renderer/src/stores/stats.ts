import { writable, derived, get } from 'svelte/store'
import type { Stats, ProblemSet } from '../../../preload/index.d'
import { currentProblemSet } from './problems'

// Stats data
export const stats = writable<Stats | null>(null)

// Loading state
export const isLoadingStats = writable(false)

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
