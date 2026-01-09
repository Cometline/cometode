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

export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = path.join(app.getPath('userData'), 'neetcode-tracker.db')
  console.log('Database path:', dbPath)

  db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Run schema
  db.exec(SCHEMA)

  // Seed problems if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM problems').get() as { count: number }
  if (count.count === 0) {
    seedProblems(db)
  }

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
