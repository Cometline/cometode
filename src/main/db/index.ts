import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { seedProblems } from './seed'

let db: Database.Database | null = null

const SCHEMA = `
-- Problems table
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  neet_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  categories TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  leetcode_url TEXT NOT NULL,
  neetcode_url TEXT NOT NULL,
  in_neetcode_150 INTEGER NOT NULL DEFAULT 0,
  in_google INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learning progress table (SM-2 core)
CREATE TABLE IF NOT EXISTS problem_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER UNIQUE NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'learning', 'reviewing')),
  repetitions INTEGER DEFAULT 0,
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review_date TEXT,
  first_learned_at DATETIME,
  last_reviewed_at DATETIME,
  total_reviews INTEGER DEFAULT 0,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- Review history table
CREATE TABLE IF NOT EXISTS review_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL,
  review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 3),
  interval_before INTEGER,
  interval_after INTEGER,
  ease_factor_before REAL,
  ease_factor_after REAL,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- User preferences table
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_progress_next_review ON problem_progress(next_review_date);
CREATE INDEX IF NOT EXISTS idx_progress_status ON problem_progress(status);
CREATE INDEX IF NOT EXISTS idx_history_problem ON review_history(problem_id);
CREATE INDEX IF NOT EXISTS idx_history_date ON review_history(review_date);
`

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

function runMigrations(database: Database.Database): void {
  // Check if in_neetcode_150 column exists in problems table
  const problemColumns = database
    .prepare("PRAGMA table_info(problems)")
    .all() as { name: string }[]
  const problemColumnNames = problemColumns.map((c) => c.name)

  if (!problemColumnNames.includes('in_neetcode_150')) {
    console.log('Running migration: adding problem set columns...')

    // Add new columns
    database.exec(`
      ALTER TABLE problems ADD COLUMN in_neetcode_150 INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE problems ADD COLUMN in_google INTEGER NOT NULL DEFAULT 0;
    `)

    // Mark existing problems as NeetCode 150
    database.exec(`UPDATE problems SET in_neetcode_150 = 1 WHERE neet_id <= 150`)

    // Reseed to add new problems
    seedProblems(database, true)
    console.log('Migration completed')
  }

  // Check if CIR algorithm columns exist in problem_progress table
  const progressColumns = database
    .prepare("PRAGMA table_info(problem_progress)")
    .all() as { name: string }[]
  const progressColumnNames = progressColumns.map((c) => c.name)

  if (!progressColumnNames.includes('success_rate')) {
    console.log('Running migration: adding CIR algorithm columns...')

    // Add CIR-specific columns
    database.exec(`
      ALTER TABLE problem_progress ADD COLUMN success_rate REAL DEFAULT 0.5;
      ALTER TABLE problem_progress ADD COLUMN consecutive_successes INTEGER DEFAULT 0;
    `)

    // Initialize consecutive_successes from existing repetitions
    // (repetitions roughly maps to consecutive successes in the old model)
    database.exec(`
      UPDATE problem_progress
      SET consecutive_successes = CASE
        WHEN repetitions >= 5 THEN 5
        ELSE repetitions
      END
    `)

    // Estimate initial success rate from total_reviews and current state
    // If they've reviewed and are in 'reviewing' status, assume ~80% success rate
    database.exec(`
      UPDATE problem_progress
      SET success_rate = CASE
        WHEN total_reviews = 0 THEN 0.5
        WHEN status = 'reviewing' THEN 0.8
        WHEN status = 'learning' THEN 0.6
        ELSE 0.5
      END
    `)

    console.log('CIR migration completed')
  }
}

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = path.join(app.getPath('userData'), 'cometode.db')
  console.log('Database path:', dbPath)

  db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Run schema (creates tables if not exist)
  db.exec(SCHEMA)

  // Check if problems table exists and has data
  const count = db.prepare('SELECT COUNT(*) as count FROM problems').get() as { count: number }

  if (count.count === 0) {
    // Fresh install - seed all problems
    seedProblems(db)
  } else {
    // Existing database - run migrations first
    runMigrations(db)
  }

  // Always ensure indexes exist (safe to run multiple times)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_problems_neetcode_150 ON problems(in_neetcode_150);
    CREATE INDEX IF NOT EXISTS idx_problems_google ON problems(in_google);
  `)

  console.log('Database initialized successfully')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('Database closed')
  }
}
