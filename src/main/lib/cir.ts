/**
 * CIR (Coding Interview Repetition) Algorithm Implementation
 *
 * A spaced repetition algorithm optimized for coding interview preparation.
 * Key differences from SM-2:
 * - Max interval of 28 days (vs unbounded)
 * - Difficulty-weighted intervals (Easy 0.7x / Hard 1.3x)
 * - Doubling progression (1→2→4→8→16→28)
 * - Success rate tracking (< 80% shortens intervals)
 * - Interview mode (halves all intervals)
 * - Local timezone support
 *
 * Quality ratings:
 * 0 - Again: Complete blackout, didn't remember at all
 * 1 - Hard: Incorrect response, but upon seeing the answer, remembered
 * 2 - Good: Correct response with some hesitation
 * 3 - Easy: Perfect response with no hesitation
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface CIRState {
  consecutiveSuccesses: number // Number of consecutive Good/Easy responses
  interval: number // Current interval in days
  easeFactor: number // Ease factor (minimum 1.3, affects interval fine-tuning)
  successRate: number // Success rate (quality >= 2 count / total reviews)
  totalReviews: number // Total number of reviews for success rate calculation
}

export interface CIRResult {
  newState: CIRState
  nextReviewDate: Date
}

// Algorithm constants
const MAX_INTERVAL_DAYS = 28
const BASE_INTERVALS = [1, 2, 4, 8, 16, 28]
const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  Easy: 1.1, // Easier to remember, can wait longer
  Medium: 1.0,
  Hard: 0.9 // Harder to remember, review more often
}
const SUCCESS_RATE_THRESHOLD = 0.8
const SUCCESS_RATE_PENALTY = 0.8
const INTERVIEW_MODE_MULTIPLIER = 0.5
const EASY_BONUS_MULTIPLIER = 1.15
const MIN_EASE_FACTOR = 1.3

// Initial ease factor for new cards
export const INITIAL_EASE_FACTOR = 2.5
export const INITIAL_SUCCESS_RATE = 0.5

/**
 * Get the base interval for a given consecutive success count
 */
function getBaseInterval(consecutiveSuccesses: number): number {
  const index = Math.min(consecutiveSuccesses, BASE_INTERVALS.length - 1)
  return BASE_INTERVALS[index]
}

/**
 * Calculate the next review state based on CIR algorithm
 *
 * @param currentState - Current CIR state
 * @param quality - Quality of response (0-3)
 * @param difficulty - Problem difficulty (Easy/Medium/Hard)
 * @param interviewMode - Whether interview mode is enabled
 * @returns New state and next review date
 */
export function calculateNextReview(
  currentState: CIRState,
  quality: number,
  difficulty: Difficulty,
  interviewMode: boolean = false
): CIRResult {
  const { consecutiveSuccesses, interval, easeFactor, successRate, totalReviews } = currentState

  // Validate quality
  const q = Math.max(0, Math.min(3, Math.round(quality)))

  // Calculate new success rate
  const newTotalReviews = totalReviews + 1
  const isSuccess = q >= 2
  const successCount = successRate * totalReviews + (isSuccess ? 1 : 0)
  const newSuccessRate = successCount / newTotalReviews

  let newConsecutiveSuccesses: number
  let newInterval: number
  let newEaseFactor: number

  if (q === 0) {
    // Again: Complete reset
    newConsecutiveSuccesses = 0
    newInterval = 1
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.1)
  } else if (q === 1) {
    // Hard: Partial setback
    newConsecutiveSuccesses = 0
    newInterval = Math.max(1, Math.round(interval * 0.5))
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.05)
  } else {
    // Good (2) or Easy (3): Progress to next stage
    newConsecutiveSuccesses = consecutiveSuccesses + 1
    newEaseFactor = easeFactor

    // Get base interval from doubling progression
    const baseInterval = getBaseInterval(newConsecutiveSuccesses)

    // Apply difficulty multiplier
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty]
    newInterval = Math.round(baseInterval * difficultyMultiplier)

    // Apply easy bonus
    if (q === 3) {
      newInterval = Math.round(newInterval * EASY_BONUS_MULTIPLIER)
    }

    // Adjust ease factor for success
    const adjustedQ = q + 2 // Map 2,3 to 4,5 for ease calculation
    newEaseFactor = Math.max(
      MIN_EASE_FACTOR,
      easeFactor + (0.1 - (5 - adjustedQ) * (0.08 + (5 - adjustedQ) * 0.02))
    )
  }

  // Apply success rate penalty if below threshold
  if (newSuccessRate < SUCCESS_RATE_THRESHOLD && isSuccess) {
    newInterval = Math.max(1, Math.round(newInterval * SUCCESS_RATE_PENALTY))
  }

  // Apply interview mode multiplier
  if (interviewMode) {
    newInterval = Math.max(1, Math.round(newInterval * INTERVIEW_MODE_MULTIPLIER))
  }

  // Cap at maximum interval
  newInterval = Math.min(MAX_INTERVAL_DAYS, newInterval)

  // Ensure minimum interval of 1 day
  newInterval = Math.max(1, newInterval)

  return {
    newState: {
      consecutiveSuccesses: newConsecutiveSuccesses,
      interval: newInterval,
      easeFactor: newEaseFactor,
      successRate: newSuccessRate,
      totalReviews: newTotalReviews
    },
    nextReviewDate: getNextReviewDate(newInterval)
  }
}

/**
 * Get the next review date given an interval in days
 * Uses local timezone
 */
function getNextReviewDate(intervalDays: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + intervalDays)
  // Reset time to start of day (local timezone)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Check if a problem is due for review (local timezone)
 */
export function isReviewDue(nextReviewDate: string | null): boolean {
  if (!nextReviewDate) return false

  const reviewDate = new Date(nextReviewDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return reviewDate <= today
}

/**
 * Format next review date as local date string (YYYY-MM-DD)
 * Uses local timezone to avoid UTC conversion issues
 */
export function formatReviewDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get quality label for display
 */
export function getQualityLabel(quality: number): string {
  switch (quality) {
    case 0:
      return 'Again'
    case 1:
      return 'Hard'
    case 2:
      return 'Good'
    case 3:
      return 'Easy'
    default:
      return 'Unknown'
  }
}

/**
 * Get quality description for display
 */
export function getQualityDescription(quality: number): string {
  switch (quality) {
    case 0:
      return '完全忘記'
    case 1:
      return '困難，需要更多練習'
    case 2:
      return '良好，但有些猶豫'
    case 3:
      return '非常熟練'
    default:
      return ''
  }
}

/**
 * Estimate days until next review for each quality option
 */
export function getIntervalPreviews(
  currentState: CIRState,
  difficulty: Difficulty,
  interviewMode: boolean = false
): Record<number, number> {
  const previews: Record<number, number> = {}

  for (let q = 0; q <= 3; q++) {
    const result = calculateNextReview(currentState, q, difficulty, interviewMode)
    previews[q] = result.newState.interval
  }

  return previews
}
