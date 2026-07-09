// Backfill fix: resources/merge-company-problems.js only flips in_<company>
// flags for problems that already exist in problems-all.json, without adding
// the company name to `categories`. This leaves problems tagged in_amazon /
// in_meta / in_microsoft that only show "Google" (or another single company)
// in their categories.
//
// This script adds the missing company category for every true in_<company>
// flag, without touching topic categories (e.g. "Arrays & Hashing") or
// removing anything already present.
//
// Usage: node scripts/sync-company-categories.js

const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const FILE = path.join(RESOURCES_DIR, 'problems-all.json');

const COMPANY_FLAGS = {
  in_google: 'Google',
  in_amazon: 'Amazon',
  in_meta: 'Meta',
  in_microsoft: 'Microsoft',
};

function main() {
  const problems = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  let fixed = 0;
  for (const entry of problems) {
    const categories = entry.categories || [];
    const missing = [];
    for (const [flag, name] of Object.entries(COMPANY_FLAGS)) {
      if (entry[flag] && !categories.includes(name)) {
        missing.push(name);
      }
    }
    if (missing.length > 0) {
      entry.categories = [...categories, ...missing];
      fixed++;
    }
  }

  fs.writeFileSync(FILE, JSON.stringify(problems, null, 2) + '\n');
  console.log(`Fixed ${fixed} problem(s) with missing company categories.`);
}

main();
