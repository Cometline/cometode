// Paste into DevTools console on a neetcode.io "company tagged" problems page
// (e.g. https://neetcode.io/practice?list=companyTagged&company=Amazon).
// Scrapes every row of the problems table, auto-advances through pagination
// (75 rows/page), and prints + copies the resulting JSON list to your clipboard.
//
// Usage: paste this whole file into the console, press Enter, then run:
//   await scrapeAllPages()

(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function scrapeCurrentPage() {
    const rows = document.querySelectorAll('tr.ng-star-inserted, table tbody tr');
    const results = [];
    rows.forEach((row) => {
      const titleAnchor = row.querySelector('a.table-text');
      if (!titleAnchor) return; // skip header/non-data rows

      const title = titleAnchor.textContent.trim();
      const neetHref = titleAnchor.getAttribute('href') || '';
      // e.g. /problems/two-integer-sum/question?list=companyTagged&company=Amazon
      const slugMatch = neetHref.match(/\/problems\/([^/]+)\/question/);
      const slug = slugMatch ? slugMatch[1] : null;
      const neetcode_url = slug ? `https://neetcode.io/problems/${slug}` : null;

      const leetAnchor = row.querySelector('a.external-link-anchor');
      const leetcode_url = leetAnchor ? leetAnchor.getAttribute('href') : null;

      const diffBtn = row.querySelector('.diff-col button b, #diff-btn b');
      const difficulty = diffBtn ? diffBtn.textContent.trim() : null;

      results.push({ title, difficulty, leetcode_url, neetcode_url });
    });
    return results;
  }

  function getPaginationText() {
    const el = document.querySelector('p.pagination-text');
    return el ? el.textContent.trim() : null;
  }

  function findNextPageButton() {
    // The pagination controls are icon-only buttons (chevron-left / chevron-right SVGs),
    // with no text or aria-label, so we match on the embedded icon instead.
    const buttons = Array.from(document.querySelectorAll('button.navbar-btn'));
    const next = buttons.find((btn) => btn.querySelector('svg[data-icon="chevron-right"]'));
    if (!next || next.disabled) return null;
    return next;
  }

  window.scrapeAllPages = async function scrapeAllPages(maxPages = 50) {
    const all = [];
    const seen = new Set();
    let pageNum = 1;

    while (pageNum <= maxPages) {
      // wait for table rows to be present/stable
      await sleep(500);
      const pageResults = scrapeCurrentPage();
      const pageLabel = getPaginationText();

      let newCount = 0;
      for (const item of pageResults) {
        const key = item.leetcode_url || item.title;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(item);
          newCount++;
        }
      }

      console.log(`Page ${pageNum} (${pageLabel}): scraped ${pageResults.length} rows, ${newCount} new. Total so far: ${all.length}`);

      const nextBtn = findNextPageButton();
      if (!nextBtn) {
        console.log('Next button missing or disabled — reached the last page.');
        break;
      }

      nextBtn.click();

      // Wait until the "Displaying X - Y" label actually changes (Angular re-render is async).
      const prevLabel = pageLabel;
      let waited = 0;
      while (getPaginationText() === prevLabel && waited < 5000) {
        await sleep(200);
        waited += 200;
      }

      pageNum++;
    }

    console.log(`Done. Total unique problems: ${all.length}`);
    console.log(JSON.stringify(all, null, 2));

    try {
      await navigator.clipboard.writeText(JSON.stringify(all, null, 2));
      console.log('Copied JSON to clipboard.');
    } catch (e) {
      console.warn('Could not copy to clipboard automatically:', e);
    }

    window.__scrapedProblems = all; // also stashed here for later access
    return all;
  };

  console.log('Loaded. Run: await scrapeAllPages()');
})();
