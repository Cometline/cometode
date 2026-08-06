import type Database from 'better-sqlite3'

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
  success_rate?: number
  consecutive_successes?: number
}

export interface ExportReviewHistoryEntry {
  neet_id: number
  review_date: string
  quality: number
  interval_before: number | null
  interval_after: number | null
  ease_factor_before: number | null
  ease_factor_after: number | null
}

export interface ExportData {
  version: string
  exportDate: string
  appVersion: string
  progress: ExportProgressEntry[]
  reviewHistory?: ExportReviewHistoryEntry[]
}

export const EXPORT_VERSION = '1.2'

function reviewHistoryKey(entry: {
  neet_id: number
  review_date: string
  quality: number
  interval_before: number | null
  interval_after: number | null
  ease_factor_before: number | null
  ease_factor_after: number | null
}): string {
  return [
    entry.neet_id,
    entry.review_date,
    entry.quality,
    entry.interval_before,
    entry.interval_after,
    entry.ease_factor_before,
    entry.ease_factor_after
  ].join('|')
}

export function fetchProgress(db: Database.Database): ExportProgressEntry[] {
  return db
    .prepare(
      `
      SELECT
        p.neet_id,
        pp.status,
        pp.repetitions,
        pp.interval,
        pp.ease_factor,
        pp.next_review_date,
        pp.first_learned_at,
        pp.last_reviewed_at,
        pp.total_reviews,
        pp.success_rate,
        pp.consecutive_successes
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE pp.total_reviews > 0
      ORDER BY p.neet_id
    `
    )
    .all() as ExportProgressEntry[]
}

export function fetchReviewHistory(db: Database.Database): ExportReviewHistoryEntry[] {
  return db
    .prepare(
      `
      SELECT
        p.neet_id,
        rh.review_date,
        rh.quality,
        rh.interval_before,
        rh.interval_after,
        rh.ease_factor_before,
        rh.ease_factor_after
      FROM review_history rh
      JOIN problems p ON rh.problem_id = p.id
      ORDER BY rh.review_date ASC
    `
    )
    .all() as ExportReviewHistoryEntry[]
}

export function buildExportData(db: Database.Database, appVersion: string): ExportData {
  return {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    appVersion,
    progress: fetchProgress(db),
    reviewHistory: fetchReviewHistory(db)
  }
}

/** Insert review history rows that are not already present locally. */
export function mergeReviewHistory(
  db: Database.Database,
  entries: ExportReviewHistoryEntry[] | undefined
): number {
  if (!entries || !Array.isArray(entries) || entries.length === 0) return 0

  const existing = db
    .prepare(
      `
      SELECT
        p.neet_id,
        rh.review_date,
        rh.quality,
        rh.interval_before,
        rh.interval_after,
        rh.ease_factor_before,
        rh.ease_factor_after
      FROM review_history rh
      JOIN problems p ON rh.problem_id = p.id
    `
    )
    .all() as ExportReviewHistoryEntry[]

  const existingKeys = new Set(existing.map(reviewHistoryKey))

  const insert = db.prepare(
    `
    INSERT INTO review_history
    (problem_id, review_date, quality, interval_before, interval_after, ease_factor_before, ease_factor_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  )

  const findProblem = db.prepare('SELECT id FROM problems WHERE neet_id = ?')

  let imported = 0

  for (const entry of entries) {
    if (
      typeof entry.neet_id !== 'number' ||
      typeof entry.review_date !== 'string' ||
      typeof entry.quality !== 'number'
    ) {
      continue
    }

    const key = reviewHistoryKey(entry)
    if (existingKeys.has(key)) continue

    const problem = findProblem.get(entry.neet_id) as { id: number } | undefined
    if (!problem) continue

    insert.run(
      problem.id,
      entry.review_date,
      entry.quality,
      entry.interval_before ?? null,
      entry.interval_after ?? null,
      entry.ease_factor_before ?? null,
      entry.ease_factor_after ?? null
    )

    existingKeys.add(key)
    imported++
  }

  return imported
}

/** Full overwrite import for manual import (progress + history merge). */
export function importProgressData(
  db: Database.Database,
  data: ExportData
): { success: boolean; error?: string; imported: number; historyImported: number } {
  if (!data || !data.progress || !Array.isArray(data.progress)) {
    return { success: false, error: 'Invalid data format', imported: 0, historyImported: 0 }
  }

  let importedCount = 0
  let historyImported = 0

  const transaction = db.transaction(() => {
    for (const entry of data.progress) {
      const problem = db.prepare('SELECT id FROM problems WHERE neet_id = ?').get(entry.neet_id) as
        | { id: number }
        | undefined

      if (!problem) continue

      const successRate = entry.success_rate ?? (entry.status === 'reviewing' ? 0.8 : 0.6)
      const consecutiveSuccesses = entry.consecutive_successes ?? Math.min(entry.repetitions, 5)

      db.prepare(
        `
        INSERT INTO problem_progress
        (problem_id, status, repetitions, interval, ease_factor, success_rate, consecutive_successes, next_review_date, first_learned_at, last_reviewed_at, total_reviews)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(problem_id) DO UPDATE SET
          status = excluded.status,
          repetitions = excluded.repetitions,
          interval = excluded.interval,
          ease_factor = excluded.ease_factor,
          success_rate = excluded.success_rate,
          consecutive_successes = excluded.consecutive_successes,
          next_review_date = excluded.next_review_date,
          first_learned_at = excluded.first_learned_at,
          last_reviewed_at = excluded.last_reviewed_at,
          total_reviews = excluded.total_reviews
      `
      ).run(
        problem.id,
        entry.status,
        entry.repetitions,
        entry.interval,
        entry.ease_factor,
        successRate,
        consecutiveSuccesses,
        entry.next_review_date,
        entry.first_learned_at,
        entry.last_reviewed_at,
        entry.total_reviews
      )

      importedCount++
    }

    historyImported = mergeReviewHistory(db, data.reviewHistory)
  })

  transaction()

  return { success: true, imported: importedCount, historyImported }
}
