// Dedupe resources/problems-all.json by title: each problem title should only
// appear once. When a title has multiple entries (e.g. an old placeholder entry
// with a blank leetcode_url plus a newer, fuller entry from a company merge),
// keep the "best" one and merge in every in_<company> flag / tag from the
// duplicates before dropping them.
//
// Usage: node scripts/dedupe-problems-by-title.js

const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const FILE = 'problems-all.json';

const PLACEHOLDER_CATEGORIES = new Set(['Google', 'Amazon', 'Meta', 'Microsoft']);

function isPlaceholderCategory(categories) {
  return categories.length === 1 && PLACEHOLDER_CATEGORIES.has(categories[0]);
}

function normTitle(title) {
  return (title || '').trim().toLowerCase();
}

// Lower score = better candidate to keep as the canonical entry.
function score(entry) {
  let s = 0;
  if (!entry.leetcode_url || !entry.leetcode_url.trim()) s += 100; // missing url is a big red flag
  if (isPlaceholderCategory(entry.categories)) s += 10;
  return s;
}

function main() {
  const filePath = path.join(RESOURCES_DIR, FILE);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const groups = new Map(); // normalized title -> entries[]
  for (const entry of data) {
    const key = normTitle(entry.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const allFlags = Object.keys(data[0]).filter((k) => k.startsWith('in_'));
  const kept = [];
  let dedupedCount = 0;

  for (const [, entries] of groups) {
    if (entries.length === 1) {
      kept.push(entries[0]);
      continue;
    }

    // Sort by score ascending; the first is our canonical entry.
    const sorted = [...entries].sort((a, b) => score(a) - score(b));
    const canonical = sorted[0];
    const dropped = sorted.slice(1);

    for (const dup of dropped) {
      for (const flag of allFlags) {
        canonical[flag] = canonical[flag] || dup[flag];
      }
      canonical.tags = Array.from(new Set([...(canonical.tags || []), ...(dup.tags || [])]));
      console.log(
        `Deduped "${dup.title}" (neet_id ${dup.neet_id}, difficulty ${dup.difficulty}) into neet_id ${canonical.neet_id}`
      );
      dedupedCount++;
    }

    kept.push(canonical);
  }

  // Preserve original relative order by neet_id.
  kept.sort((a, b) => a.neet_id - b.neet_id);

  fs.writeFileSync(filePath, JSON.stringify(kept, null, 2) + '\n');
  console.log(
    `\nDone. Removed ${dedupedCount} duplicate title(s). problems-all.json now has ${kept.length} problems.`
  );
}

main();
