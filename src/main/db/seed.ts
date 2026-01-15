import Database from 'better-sqlite3'
import allProblems from '../../../resources/problems-all.json'

interface Problem {
  neet_id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  categories: string[]
  tags: string[]
  leetcode_url: string
  neetcode_url: string
  in_neetcode_150: boolean
  in_google: boolean
}

export function seedProblems(db: Database.Database, isMigration = false): void {
  if (isMigration) {
    // Migration mode: upsert problems
    const upsert = db.prepare(`
      INSERT INTO problems (neet_id, title, difficulty, categories, tags, leetcode_url, neetcode_url, in_neetcode_150, in_google)
      VALUES (@neet_id, @title, @difficulty, @categories, @tags, @leetcode_url, @neetcode_url, @in_neetcode_150, @in_google)
      ON CONFLICT(neet_id) DO UPDATE SET
        title = excluded.title,
        difficulty = excluded.difficulty,
        categories = excluded.categories,
        tags = excluded.tags,
        leetcode_url = excluded.leetcode_url,
        neetcode_url = excluded.neetcode_url,
        in_neetcode_150 = excluded.in_neetcode_150,
        in_google = excluded.in_google
    `)

    const upsertMany = db.transaction((problems: Problem[]) => {
      for (const problem of problems) {
        upsert.run({
          neet_id: problem.neet_id,
          title: problem.title,
          difficulty: problem.difficulty,
          categories: JSON.stringify(problem.categories),
          tags: JSON.stringify(problem.tags),
          leetcode_url: problem.leetcode_url,
          neetcode_url: problem.neetcode_url,
          in_neetcode_150: problem.in_neetcode_150 ? 1 : 0,
          in_google: problem.in_google ? 1 : 0
        })
      }
    })

    upsertMany(allProblems as Problem[])
    console.log(`Migrated/updated ${allProblems.length} problems`)
  } else {
    // Fresh seed mode: insert all
    const insert = db.prepare(`
      INSERT INTO problems (neet_id, title, difficulty, categories, tags, leetcode_url, neetcode_url, in_neetcode_150, in_google)
      VALUES (@neet_id, @title, @difficulty, @categories, @tags, @leetcode_url, @neetcode_url, @in_neetcode_150, @in_google)
    `)

    const insertMany = db.transaction((problems: Problem[]) => {
      for (const problem of problems) {
        insert.run({
          neet_id: problem.neet_id,
          title: problem.title,
          difficulty: problem.difficulty,
          categories: JSON.stringify(problem.categories),
          tags: JSON.stringify(problem.tags),
          leetcode_url: problem.leetcode_url,
          neetcode_url: problem.neetcode_url,
          in_neetcode_150: problem.in_neetcode_150 ? 1 : 0,
          in_google: problem.in_google ? 1 : 0
        })
      }
    })

    insertMany(allProblems as Problem[])
    console.log(`Seeded ${allProblems.length} problems`)
  }
}
