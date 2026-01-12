import { ipcMain, dialog } from 'electron'
import { writeFileSync, readFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { calculateNextReview, formatReviewDate, INITIAL_EASE_FACTOR } from './lib/sm2'
import { app } from 'electron'

// Types
interface ProblemFilters {
  difficulty?: string
  category?: string
  status?: string
  searchText?: string
  dueOnly?: boolean
}

interface ReviewSubmission {
  problemId: number
  quality: number
}

interface PreferenceData {
  key: string
  value: string
}

interface ExportProgressEntry {
  neet_id: number
  status: string
  repetitions: number
  interval: number
  ease_factor: number
  next_review_date: string | null
  first_learned_at: string | null
  last_reviewed_at: string | null
  total_reviews: number
}

interface ExportHistoryEntry {
  neet_id: number
  review_date: string
  quality: number
  interval_before: number
  interval_after: number
  ease_factor_before: number
  ease_factor_after: number
}

interface ExportData {
  version: string
  exportDate: string
  appVersion: string
  progress: ExportProgressEntry[]
  history: ExportHistoryEntry[]
}

export function setupIPC(db: Database.Database): void {
  // Get all problems with progress
  ipcMain.handle('get-problems', (_event, filters?: ProblemFilters) => {
    let query = `
      SELECT
        p.id,
        p.neet_id,
        p.title,
        p.difficulty,
        p.categories,
        p.tags,
        p.leetcode_url,
        p.neetcode_url,
        COALESCE(pp.status, 'new') as status,
        COALESCE(pp.repetitions, 0) as repetitions,
        COALESCE(pp.interval, 0) as interval,
        COALESCE(pp.ease_factor, ${INITIAL_EASE_FACTOR}) as ease_factor,
        pp.next_review_date,
        COALESCE(pp.total_reviews, 0) as total_reviews,
        pp.last_reviewed_at
      FROM problems p
      LEFT JOIN problem_progress pp ON p.id = pp.problem_id
      WHERE 1=1
    `

    const params: (string | number)[] = []

    if (filters?.difficulty) {
      query += ' AND p.difficulty = ?'
      params.push(filters.difficulty)
    }

    if (filters?.category) {
      query += ' AND p.categories LIKE ?'
      params.push(`%${filters.category}%`)
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'new') {
        query += ' AND (pp.status IS NULL OR pp.status = "new")'
      } else {
        query += ' AND pp.status = ?'
        params.push(filters.status)
      }
    }

    if (filters?.searchText) {
      query += ' AND (p.title LIKE ? OR CAST(p.neet_id AS TEXT) LIKE ?)'
      params.push(`%${filters.searchText}%`, `%${filters.searchText}%`)
    }

    if (filters?.dueOnly) {
      query += " AND pp.next_review_date IS NOT NULL AND DATE(pp.next_review_date) <= DATE('now')"
    }

    // Sort order:
    // 1. Due for review (has next_review_date <= today)
    // 2. New/never practiced (total_reviews = 0 or NULL)
    // 3. Then by problem number
    query += ` ORDER BY
      CASE
        WHEN pp.next_review_date IS NOT NULL AND DATE(pp.next_review_date) <= DATE('now') THEN 0
        WHEN COALESCE(pp.total_reviews, 0) = 0 THEN 1
        ELSE 2
      END ASC,
      p.neet_id ASC`

    const stmt = db.prepare(query)
    return stmt.all(...params)
  })

  // Get single problem by ID
  ipcMain.handle('get-problem', (_event, problemId: number) => {
    const query = `
      SELECT
        p.id,
        p.neet_id,
        p.title,
        p.difficulty,
        p.categories,
        p.tags,
        p.leetcode_url,
        p.neetcode_url,
        COALESCE(pp.status, 'new') as status,
        COALESCE(pp.repetitions, 0) as repetitions,
        COALESCE(pp.interval, 0) as interval,
        COALESCE(pp.ease_factor, ${INITIAL_EASE_FACTOR}) as ease_factor,
        pp.next_review_date,
        COALESCE(pp.total_reviews, 0) as total_reviews,
        pp.last_reviewed_at
      FROM problems p
      LEFT JOIN problem_progress pp ON p.id = pp.problem_id
      WHERE p.id = ?
    `
    return db.prepare(query).get(problemId)
  })

  // Get today's due reviews
  ipcMain.handle('get-today-reviews', () => {
    const query = `
      SELECT
        p.id,
        p.neet_id,
        p.title,
        p.difficulty,
        p.leetcode_url,
        p.neetcode_url,
        pp.repetitions,
        pp.ease_factor,
        pp.next_review_date
      FROM problems p
      JOIN problem_progress pp ON p.id = pp.problem_id
      WHERE pp.next_review_date IS NOT NULL
        AND DATE(pp.next_review_date) <= DATE('now')
        AND pp.status != 'new'
      ORDER BY pp.ease_factor ASC, p.neet_id ASC
    `
    return db.prepare(query).all()
  })

  // Submit review result
  ipcMain.handle('submit-review', (_event, data: ReviewSubmission) => {
    const { problemId, quality } = data

    // Get current progress
    const progress = db
      .prepare(
        `
      SELECT repetitions, interval, ease_factor
      FROM problem_progress
      WHERE problem_id = ?
    `
      )
      .get(problemId) as { repetitions: number; interval: number; ease_factor: number } | undefined

    const currentState = {
      repetitions: progress?.repetitions ?? 0,
      interval: progress?.interval ?? 0,
      easeFactor: progress?.ease_factor ?? INITIAL_EASE_FACTOR
    }

    // Calculate new state
    const { newState, nextReviewDate } = calculateNextReview(currentState, quality)
    const nextReviewStr = formatReviewDate(nextReviewDate)

    // Determine status
    let status = 'learning'
    if (newState.repetitions >= 3) {
      status = 'reviewing'
    }

    // Transaction: update progress and record history
    const transaction = db.transaction(() => {
      // Upsert progress
      db.prepare(
        `
        INSERT INTO problem_progress
        (problem_id, status, repetitions, interval, ease_factor, next_review_date, last_reviewed_at, total_reviews, first_learned_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))
        ON CONFLICT(problem_id) DO UPDATE SET
          status = excluded.status,
          repetitions = excluded.repetitions,
          interval = excluded.interval,
          ease_factor = excluded.ease_factor,
          next_review_date = excluded.next_review_date,
          last_reviewed_at = excluded.last_reviewed_at,
          total_reviews = total_reviews + 1
      `
      ).run(
        problemId,
        status,
        newState.repetitions,
        newState.interval,
        newState.easeFactor,
        nextReviewStr
      )

      // Record history
      db.prepare(
        `
        INSERT INTO review_history
        (problem_id, quality, interval_before, interval_after, ease_factor_before, ease_factor_after)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(
        problemId,
        quality,
        currentState.interval,
        newState.interval,
        currentState.easeFactor,
        newState.easeFactor
      )
    })

    transaction()

    return {
      success: true,
      nextReviewDate: nextReviewStr,
      newInterval: newState.interval
    }
  })

  // Get statistics
  ipcMain.handle('get-stats', () => {
    const total = db.prepare('SELECT COUNT(*) as count FROM problems').get() as { count: number }

    const byDifficulty = db
      .prepare(
        `
      SELECT
        p.difficulty,
        COUNT(*) as total,
        SUM(CASE WHEN pp.total_reviews > 0 THEN 1 ELSE 0 END) as practiced,
        SUM(CASE WHEN pp.repetitions >= 3 THEN 1 ELSE 0 END) as mastered
      FROM problems p
      LEFT JOIN problem_progress pp ON p.id = pp.problem_id
      GROUP BY p.difficulty
      ORDER BY
        CASE p.difficulty
          WHEN 'Easy' THEN 1
          WHEN 'Medium' THEN 2
          WHEN 'Hard' THEN 3
        END
    `
      )
      .all()

    const byCategory = db
      .prepare(
        `
      SELECT
        json_each.value as category,
        COUNT(*) as total,
        SUM(CASE WHEN pp.total_reviews > 0 THEN 1 ELSE 0 END) as practiced
      FROM problems p, json_each(p.categories)
      LEFT JOIN problem_progress pp ON p.id = pp.problem_id
      GROUP BY json_each.value
      ORDER BY total DESC
    `
      )
      .all()

    const todayDue = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM problem_progress
      WHERE DATE(next_review_date) <= DATE('now')
        AND status != 'new'
    `
      )
      .get() as { count: number }

    const reviewHistory = db
      .prepare(
        `
      SELECT
        DATE(review_date) as date,
        COUNT(*) as count
      FROM review_history
      GROUP BY DATE(review_date)
      ORDER BY date DESC
      LIMIT 30
    `
      )
      .all()

    const totalReviews = db.prepare('SELECT COUNT(*) as count FROM review_history').get() as {
      count: number
    }

    const practiced = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM problem_progress
      WHERE total_reviews > 0
    `
      )
      .get() as { count: number }

    return {
      total: total.count,
      practiced: practiced.count,
      todayDue: todayDue.count,
      totalReviews: totalReviews.count,
      byDifficulty,
      byCategory,
      reviewHistory
    }
  })

  // Get categories list
  ipcMain.handle('get-categories', () => {
    const categories = db
      .prepare(
        `
      SELECT DISTINCT json_each.value as category
      FROM problems p, json_each(p.categories)
      ORDER BY category
    `
      )
      .all() as { category: string }[]
    return categories.map((c) => c.category)
  })

  // Save preference
  ipcMain.handle('save-preference', (_event, data: PreferenceData) => {
    db.prepare(
      `
      INSERT INTO preferences (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
    ).run(data.key, data.value)

    return { success: true }
  })

  // Get preference
  ipcMain.handle('get-preference', (_event, key: string) => {
    const result = db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return result?.value ?? null
  })

  // Mark problem as started (first time opening)
  ipcMain.handle('start-problem', (_event, problemId: number) => {
    const existing = db
      .prepare('SELECT id FROM problem_progress WHERE problem_id = ?')
      .get(problemId)

    if (!existing) {
      // Create initial progress - no next_review_date until first review is submitted
      db.prepare(
        `
        INSERT INTO problem_progress
        (problem_id, status, repetitions, interval, ease_factor, next_review_date, first_learned_at)
        VALUES (?, 'learning', 0, 0, ${INITIAL_EASE_FACTOR}, NULL, datetime('now'))
      `
      ).run(problemId)
    }

    return { success: true }
  })

  // Reset all progress
  ipcMain.handle('reset-all-progress', () => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM problem_progress').run()
      db.prepare('DELETE FROM review_history').run()
    })

    transaction()

    return { success: true }
  })

  // Export progress data
  ipcMain.handle('export-progress', () => {
    const progress = db
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
        pp.total_reviews
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE pp.total_reviews > 0
      ORDER BY p.neet_id
    `
      )
      .all() as ExportProgressEntry[]

    const history = db
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
      ORDER BY rh.review_date
    `
      )
      .all() as ExportHistoryEntry[]

    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: app.getVersion(),
      progress,
      history
    }

    return exportData
  })

  // Import progress data
  ipcMain.handle('import-progress', (_event, data: ExportData) => {
    if (!data || !data.progress || !Array.isArray(data.progress)) {
      return { success: false, error: 'Invalid data format', imported: 0 }
    }

    let importedCount = 0

    const transaction = db.transaction(() => {
      // Import progress entries
      for (const entry of data.progress) {
        // Find problem by neet_id
        const problem = db
          .prepare('SELECT id FROM problems WHERE neet_id = ?')
          .get(entry.neet_id) as { id: number } | undefined

        if (!problem) continue

        // Upsert progress
        db.prepare(
          `
          INSERT INTO problem_progress
          (problem_id, status, repetitions, interval, ease_factor, next_review_date, first_learned_at, last_reviewed_at, total_reviews)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(problem_id) DO UPDATE SET
            status = excluded.status,
            repetitions = excluded.repetitions,
            interval = excluded.interval,
            ease_factor = excluded.ease_factor,
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
          entry.next_review_date,
          entry.first_learned_at,
          entry.last_reviewed_at,
          entry.total_reviews
        )

        importedCount++
      }

      // Import history entries (append, don't replace)
      if (data.history && Array.isArray(data.history)) {
        for (const entry of data.history) {
          const problem = db
            .prepare('SELECT id FROM problems WHERE neet_id = ?')
            .get(entry.neet_id) as { id: number } | undefined

          if (!problem) continue

          db.prepare(
            `
            INSERT INTO review_history
            (problem_id, review_date, quality, interval_before, interval_after, ease_factor_before, ease_factor_after)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          ).run(
            problem.id,
            entry.review_date,
            entry.quality,
            entry.interval_before,
            entry.interval_after,
            entry.ease_factor_before,
            entry.ease_factor_after
          )
        }
      }
    })

    transaction()

    return { success: true, imported: importedCount }
  })

  // Show save dialog for export
  ipcMain.handle('show-save-dialog', async (_event, defaultFileName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    return result.filePath || null
  })

  // Show open dialog for import
  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    return result.filePaths[0] || null
  })

  // Write file (for export)
  ipcMain.handle('write-file', (_event, filePath: string, content: string) => {
    try {
      writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Read file (for import)
  ipcMain.handle('read-file', (_event, filePath: string) => {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
