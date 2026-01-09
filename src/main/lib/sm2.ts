/**
 * SM-2 Spaced Repetition Algorithm Implementation
 *
 * Quality ratings:
 * 0 - Again: Complete blackout, didn't remember at all
 * 1 - Hard: Incorrect response, but upon seeing the answer, remembered
 * 2 - Good: Correct response with some hesitation
 * 3 - Easy: Perfect response with no hesitation
 */

export interface SM2State {
  repetitions: number // Number of consecutive correct responses
  interval: number // Current interval in days
  easeFactor: number // Ease factor (minimum 1.3)
}

export interface SM2Result {
  newState: SM2State
  nextReviewDate: Date
}

// Quality threshold - responses below this are considered failures
const QUALITY_THRESHOLD = 2

// Minimum ease factor
const MIN_EASE_FACTOR = 1.3

// Initial ease factor for new cards
export const INITIAL_EASE_FACTOR = 2.5

/**
 * Calculate the next review state based on SM-2 algorithm
 *
 * @param currentState - Current SM2 state
 * @param quality - Quality of response (0-3)
 * @returns New state and next review date
 */
export function calculateNextReview(currentState: SM2State, quality: number): SM2Result {
  const { repetitions, interval, easeFactor } = currentState

  // Validate quality
  const q = Math.max(0, Math.min(3, Math.round(quality)))

  // If quality is below threshold, reset repetitions (failed)
  if (q < QUALITY_THRESHOLD) {
    // Reset to learning phase - review again tomorrow
    const newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2)

    return {
      newState: {
        repetitions: 0,
        interval: 1, // Review again tomorrow (minimum 1 day)
        easeFactor: newEaseFactor
      },
      nextReviewDate: getNextReviewDate(1)
    }
  }

  // Successful review - calculate new ease factor
  // Adjusted formula for 0-3 scale (original SM-2 uses 0-5)
  const adjustedQ = q + 2 // Map 2,3 to 4,5 for ease calculation
  const newEaseFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - adjustedQ) * (0.08 + (5 - adjustedQ) * 0.02))
  )

  // Calculate new interval
  let newInterval: number
  const newRepetitions = repetitions + 1

  if (newRepetitions === 1) {
    // First successful review
    newInterval = 1
  } else if (newRepetitions === 2) {
    // Second successful review
    newInterval = 3
  } else {
    // Subsequent reviews
    newInterval = Math.round(interval * newEaseFactor)
  }

  // Bonus for "Easy" responses
  if (q === 3) {
    newInterval = Math.round(newInterval * 1.3)
  }

  // Ensure minimum interval of 1 day
  newInterval = Math.max(1, newInterval)

  return {
    newState: {
      repetitions: newRepetitions,
      interval: newInterval,
      easeFactor: newEaseFactor
    },
    nextReviewDate: getNextReviewDate(newInterval)
  }
}

/**
 * Get the next review date given an interval in days
 */
function getNextReviewDate(intervalDays: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + intervalDays)
  // Reset time to start of day
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Check if a problem is due for review
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
 * Note: Uses local timezone to avoid UTC conversion issues
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
export function getIntervalPreviews(currentState: SM2State): Record<number, number> {
  const previews: Record<number, number> = {}

  for (let q = 0; q <= 3; q++) {
    const result = calculateNextReview(currentState, q)
    previews[q] = result.newState.interval
  }

  return previews
}
