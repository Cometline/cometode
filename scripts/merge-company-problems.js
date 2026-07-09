// Merge company-tagged problem lists (amazon.json, meta.json, microsoft.json) into
// resources/problems-all.json.
//
// Convention used by this repo (established by the existing "Google" entries):
//   - Problems already present (matched by leetcode_url) just get their
//     in_<company> flag flipped to true; their existing categories/tags/neet_id
//     are left untouched.
//   - Problems that are brand new get a placeholder category equal to the
//     company name (e.g. ["Amazon"]), empty tags, and neet_id continuing on
//     from the current max.
//   - A problem new to this merge that appears in more than one of the three
//     company files only gets ONE new entry, with every relevant in_<company>
//     flag set to true (not three duplicate entries).
//
// Usage: node scripts/merge-company-problems.js

const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, '..', 'resources');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(RESOURCES_DIR, name), 'utf8'));
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(RESOURCES_DIR, name), JSON.stringify(data, null, 2) + '\n');
}

function normUrl(url) {
  return (url || '').trim().replace(/\/+$/, '').toLowerCase();
}

const COMPANIES = [
  { file: 'amazon.json', flag: 'in_amazon', placeholderCategory: 'Amazon' },
  { file: 'meta.json', flag: 'in_meta', placeholderCategory: 'Meta' },
  { file: 'microsoft.json', flag: 'in_microsoft', placeholderCategory: 'Microsoft' },
  { file: 'google.json', flag: 'in_google', placeholderCategory: 'Google' },
];
const ALL_FLAGS = ['in_neetcode_150', 'in_google', ...COMPANIES.map((c) => c.flag)];

const PLACEHOLDER_CATEGORIES = new Set(['Google', ...COMPANIES.map((c) => c.placeholderCategory)]);

function isPlaceholderCategory(categories) {
  return categories.length === 1 && PLACEHOLDER_CATEGORIES.has(categories[0]);
}

function ensureFlags(entry) {
  for (const flag of ALL_FLAGS) {
    if (typeof entry[flag] !== 'boolean') entry[flag] = false;
  }
  return entry;
}

function main() {
  const problemsAll = readJson('problems-all.json').map(ensureFlags);

  // --- Step 1: dedupe existing entries that share a leetcode_url (pre-existing data bug). ---
  const byUrl = new Map();
  const deduped = [];
  for (const entry of problemsAll) {
    const key = normUrl(entry.leetcode_url);
    if (!key) {
      deduped.push(entry); // no url to dedupe on (shouldn't happen, but be safe)
      continue;
    }
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, entry);
      deduped.push(entry);
      continue;
    }
    // Merge `entry` into `existing`: prefer the one with a real (non-placeholder) category.
    const existingIsPlaceholder = isPlaceholderCategory(existing.categories);
    const entryIsPlaceholder = isPlaceholderCategory(entry.categories);
    let canonical = existing;
    let dropped = entry;
    if (existingIsPlaceholder && !entryIsPlaceholder) {
      canonical = entry;
      dropped = existing;
    }
    for (const flag of ALL_FLAGS) {
      canonical[flag] = canonical[flag] || dropped[flag];
    }
    canonical.tags = Array.from(new Set([...canonical.tags, ...dropped.tags]));
    if (canonical !== existing) {
      // swap the entry we kept in both the map and the output array
      const idx = deduped.indexOf(existing);
      deduped[idx] = canonical;
      byUrl.set(key, canonical);
    }
    console.log(
      `Deduped "${dropped.title}" (neet_id ${dropped.neet_id}) into neet_id ${canonical.neet_id}`
    );
  }

  let nextNeetId = Math.max(...deduped.map((e) => e.neet_id)) + 1;
  const newEntries = []; // new problems introduced by this merge, keyed by url via byUrl too once added

  for (const company of COMPANIES) {
    const list = readJson(company.file);
    let matched = 0;
    let created = 0;
    for (const item of list) {
      const key = normUrl(item.leetcode_url);
      let entry = byUrl.get(key);
      if (entry) {
        if (!entry[company.flag]) {
          entry[company.flag] = true;
          matched++;
        }
        continue;
      }
      entry = ensureFlags({
        neet_id: nextNeetId++,
        title: item.title,
        difficulty: item.difficulty,
        categories: [company.placeholderCategory],
        tags: [],
        leetcode_url: item.leetcode_url,
        neetcode_url: item.neetcode_url,
      });
      entry[company.flag] = true;
      byUrl.set(key, entry);
      newEntries.push(entry);
      created++;
    }
    console.log(`${company.file}: ${matched} matched existing, ${created} new problems added`);
  }

  const merged = [...deduped, ...newEntries];
  writeJson('problems-all.json', merged);
  console.log(`\nDone. problems-all.json now has ${merged.length} problems.`);
}

main();
