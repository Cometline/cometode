import { ipcMain, dialog } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'
import { calculateNextReview, formatReviewDate, INITIAL_EASE_FACTOR } from './lib/sm2'
import { app } from 'electron'

// Types
type ProblemSet = 'neetcode150' | 'google' | 'all'

interface ProblemFilters {
  difficulty?: string[]
  category?: string
  status?: string
  searchText?: string
  dueOnly?: boolean
  problemSet?: ProblemSet
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

interface ExportData {
  version: string
  exportDate: string
  appVersion: string
  progress: ExportProgressEntry[]
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
        p.in_neetcode_150,
        p.in_google,
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

    // Filter by problem set
    if (filters?.problemSet === 'neetcode150') {
      query += ' AND p.in_neetcode_150 = 1'
    } else if (filters?.problemSet === 'google') {
      query += ' AND p.in_google = 1'
    }
    // 'all' or undefined means no filter

    if (filters?.difficulty && filters.difficulty.length > 0) {
      const placeholders = filters.difficulty.map(() => '?').join(', ')
      query += ` AND p.difficulty IN (${placeholders})`
      params.push(...filters.difficulty)
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

    })

    transaction()

    return {
      success: true,
      nextReviewDate: nextReviewStr,
      newInterval: newState.interval
    }
  })

  // Get statistics
  ipcMain.handle('get-stats', (_event, problemSet?: ProblemSet) => {
    // Build WHERE clause based on problem set
    let problemSetFilter = ''
    if (problemSet === 'neetcode150') {
      problemSetFilter = ' WHERE p.in_neetcode_150 = 1'
    } else if (problemSet === 'google') {
      problemSetFilter = ' WHERE p.in_google = 1'
    }

    const total = db
      .prepare(`SELECT COUNT(*) as count FROM problems p${problemSetFilter}`)
      .get() as { count: number }

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
      ${problemSetFilter}
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
      ${problemSetFilter ? problemSetFilter.replace('WHERE', 'WHERE 1=1 AND') : ''}
      GROUP BY json_each.value
      ORDER BY total DESC
    `
      )
      .all()

    // For todayDue, we need to join with problems to filter by set
    let todayDueQuery = `
      SELECT COUNT(*) as count
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE DATE(pp.next_review_date) <= DATE('now')
        AND pp.status != 'new'
    `
    if (problemSet === 'neetcode150') {
      todayDueQuery += ' AND p.in_neetcode_150 = 1'
    } else if (problemSet === 'google') {
      todayDueQuery += ' AND p.in_google = 1'
    }
    const todayDue = db.prepare(todayDueQuery).get() as { count: number }

    // Calculate total reviews from problem_progress
    let totalReviewsQuery = `
      SELECT COALESCE(SUM(pp.total_reviews), 0) as count
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE 1=1
    `
    if (problemSet === 'neetcode150') {
      totalReviewsQuery += ' AND p.in_neetcode_150 = 1'
    } else if (problemSet === 'google') {
      totalReviewsQuery += ' AND p.in_google = 1'
    }
    const totalReviews = db.prepare(totalReviewsQuery).get() as { count: number }

    // For practiced, join with problems to filter by set
    let practicedQuery = `
      SELECT COUNT(*) as count
      FROM problem_progress pp
      JOIN problems p ON pp.problem_id = p.id
      WHERE pp.total_reviews > 0
    `
    if (problemSet === 'neetcode150') {
      practicedQuery += ' AND p.in_neetcode_150 = 1'
    } else if (problemSet === 'google') {
      practicedQuery += ' AND p.in_google = 1'
    }
    const practiced = db.prepare(practicedQuery).get() as { count: number }

    return {
      total: total.count,
      practiced: practiced.count,
      todayDue: todayDue.count,
      totalReviews: totalReviews.count,
      byDifficulty,
      byCategory,
      reviewHistory: [] // No longer tracking daily history
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

    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: app.getVersion(),
      progress
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

  // ===== Auto-Sync Handlers =====

  // Get auto-sync preferences
  ipcMain.handle('get-auto-sync-preferences', () => {
    const enabled = db.prepare('SELECT value FROM preferences WHERE key = ?').get('sync_enabled') as
      | { value: string }
      | undefined

    const folderPath = db
      .prepare('SELECT value FROM preferences WHERE key = ?')
      .get('sync_folder_path') as { value: string } | undefined

    const lastExport = db
      .prepare('SELECT value FROM preferences WHERE key = ?')
      .get('last_export_date') as { value: string } | undefined

    const lastImport = db
      .prepare('SELECT value FROM preferences WHERE key = ?')
      .get('last_import_date') as { value: string } | undefined

    return {
      enabled: enabled?.value === 'true',
      folderPath: folderPath?.value || null,
      lastExportDate: lastExport?.value || null,
      lastImportDate: lastImport?.value || null
    }
  })

  // Set auto-sync preferences
  ipcMain.handle(
    'set-auto-sync-preferences',
    (_event, data: { enabled: boolean; folderPath?: string }) => {
      const transaction = db.transaction(() => {
        db.prepare(
          `
        INSERT INTO preferences (key, value, updated_at)
        VALUES ('sync_enabled', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
        ).run(data.enabled ? 'true' : 'false')

        if (data.folderPath !== undefined) {
          db.prepare(
            `
          INSERT INTO preferences (key, value, updated_at)
          VALUES ('sync_folder_path', ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `
          ).run(data.folderPath)
        }
      })

      transaction()
      return { success: true }
    }
  )

  // Show folder dialog for sync folder selection
  ipcMain.handle('show-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.filePaths[0] || null
  })

  // Perform auto-export to specified folder
  ipcMain.handle('perform-auto-export', (_event, folderPath: string) => {
    try {
      // Get export data (same logic as export-progress)
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

      const exportData: ExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appVersion: app.getVersion(),
        progress
      }

      const filePath = path.join(folderPath, 'cometode-progress.json')
      writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')

      // Update last export date
      db.prepare(
        `
        INSERT INTO preferences (key, value, updated_at)
        VALUES ('last_export_date', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
      ).run(new Date().toISOString())

      return { success: true, exportedCount: progress.length }
    } catch (error) {
      console.error('Auto-export failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // Check if auto-import is needed (compare dates)
  ipcMain.handle('check-auto-import', (_event, folderPath: string) => {
    try {
      const filePath = path.join(folderPath, 'cometode-progress.json')

      // Check if file exists
      if (!existsSync(filePath)) {
        return { shouldImport: false, reason: 'File not found' }
      }

      // Read export file
      const content = readFileSync(filePath, 'utf-8')
      const exportData = JSON.parse(content) as ExportData

      if (!exportData.exportDate) {
        return { shouldImport: false, reason: 'Invalid file format' }
      }

      const exportDate = new Date(exportData.exportDate)

      // Get max last_reviewed_at from DB
      const maxReview = db
        .prepare('SELECT MAX(last_reviewed_at) as max_date FROM problem_progress')
        .get() as { max_date: string | null }

      const maxLocalDate = maxReview.max_date ? new Date(maxReview.max_date) : null

      // Compare dates - import if export is newer
      const shouldImport = !maxLocalDate || exportDate > maxLocalDate

      return {
        shouldImport,
        exportDate: exportData.exportDate,
        maxLocalDate: maxLocalDate?.toISOString() || null,
        data: shouldImport ? exportData : null
      }
    } catch (error) {
      console.error('Auto-import check failed:', error)
      return { shouldImport: false, reason: String(error) }
    }
  })

  // Update last import date preference
  ipcMain.handle('set-last-import-date', () => {
    db.prepare(
      `
      INSERT INTO preferences (key, value, updated_at)
      VALUES ('last_import_date', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `
    ).run(new Date().toISOString())
    return { success: true }
  })
}
