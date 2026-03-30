---
phase: 02-reliability
plan: 01
type: execute
wave: 1
depends_on: [01-foundation-01]
files_modified:
  - main.js
  - config.js
autonomous: true
requirements:
  - REL-01
  - REL-02
  - REL-03

must_haves:
  truths:
    - "Network timeouts retry up to 3 times with exponential backoff (1s, 2s, 4s)"
    - "Each request waits configured delay (default 2s) between page loads"
    - "Pagination stops automatically when no jobs found on page"
    - "Log output shows retry attempts and rate limit delays"
    - "Max pages can be overridden via --max-pages argument"
  artifacts:
    - path: main.js
      provides: Retry logic with exponential backoff, configurable delay, automatic pagination stop
    - path: config.js
      provides: --max-pages CLI argument
---

<objective>
Add production-ready reliability features to the LinkedIn jobs scraper: retry logic with exponential backoff, rate limiting delays, automatic pagination stopping, and max pages control.

Purpose: Make scraping resilient to network issues and prevent indefinite pagination.
Output: Updated main.js with retry/limit features, updated config.js with --max-pages option.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@main.js
@config.js

## Current Code Context

**main.js - MISSING RELIABILITY FEATURES:**

1. **No retry logic** - Line 37: `await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });`
   - Needs: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
   - Needs: Log retry attempts

2. **Hardcoded delay** - Line 62: `await page.waitForTimeout(2000)`
   - Needs: Configurable delay via config.js (default 2s)

3. **No pagination stop** - Line 34: `for (let pageNumber = 0; pageNumber < 1000; pageNumber += 25)`
   - Needs: Stop when no jobs found on page
   - Needs: --max-pages CLI argument (default: unlimited/1000 iterations)

4. **No logging** - Needs console.log for retry attempts and rate limit delays

**config.js - MISSING --max-pages:**
- Add --max-pages/-m option with default 0 (unlimited)
- Document the option in help output
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update config.js with --max-pages and delay options</name>
  <files>config.js</files>
  <action>
    Update config.js to add:

    1. **Add --max-pages option:**
       - Option: `-m, --max-pages <number>`
       - Default: 0 (unlimited)
       - Help: "Maximum number of pages to scrape (0 = unlimited)"

    2. **Add delay option (optional, can use env var or hardcoded default):**
       - Keep existing CLI interface
       - Default delay: 2000ms (2 seconds)
       - Can be made configurable via env var REQUEST_DELAY_MS

    3. **Export getDelay() function:**
       ```javascript
       function getDelay() {
         return parseInt(process.env.REQUEST_DELAY_MS) || 2000;
       }
       ```

    4. **Update getSearchConfig() to include maxPages:**
       ```javascript
       return {
         keyword: options.keyword,
         location: options.location,
         maxPages: options.maxPages || 0
       };
       ```
  </action>
  <verify>
    <automated>node main.js --help 2>&1 | grep -E "max-pages|maxPages"</automated>
  </verify>
  <done>--max-pages/-m option appears in --help output</done>
</task>

<task type="auto">
  <name>Task 2: Implement retry logic with exponential backoff in main.js</name>
  <files>main.js</files>
  <action>
    Create a helper function for retry logic and update page.goto calls:

    1. **Add retry helper at the top of main.js (after requires):**
       ```javascript
       const MAX_RETRIES = 3;
       const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

       async function gotoWithRetry(page, url, options = {}) {
         const timeout = options.timeout || 60000;
         
         for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
           try {
             if (attempt > 0) {
               console.log(`Retry ${attempt}/${MAX_RETRIES} for ${url} after ${BACKOFF_DELAYS[attempt-1]}ms`);
               await new Promise(resolve => setTimeout(resolve, BACKOFF_DELAYS[attempt-1]));
             }
             await page.goto(url, { ...options, timeout });
             return true; // Success
           } catch (error) {
             if (attempt === MAX_RETRIES) {
               console.error(`Failed after ${MAX_RETRIES} retries: ${url}`);
               throw error;
             }
             console.log(`Timeout on attempt ${attempt + 1}, retrying...`);
           }
         }
       }
       ```

    2. **Replace line 37 (page.goto for searchUrl):**
       ```javascript
       // REPLACE:
       await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
       // WITH:
       await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded' });
       ```

    3. **Replace line 54 (page.goto for jobLink):**
       ```javascript
       // REPLACE:
       await page.goto(jobLink, { waitUntil: 'domcontentloaded', timeout: 60000});
       // WITH:
       await gotoWithRetry(page, jobLink, { waitUntil: 'domcontentloaded' });
       ```
  </action>
  <verify>
    <automated>grep -n "gotoWithRetry" main.js | wc -l</automated>
  </verify>
  <done>gotoWithRetry function exists and is used in place of page.goto</done>
</task>

<task type="auto">
  <name>Task 3: Add configurable rate limiting delay and max-pages control</name>
  <files>main.js</files>
  <action>
    Update main.js to:

    1. **Update imports to include getDelay:**
       ```javascript
       const { getCredentials, getSearchConfig, validateEnvironment, getDelay } = require('./config.js');
       ```

    2. **Update startup to extract maxPages and delay:**
       ```javascript
       // After line 9:
       const { keyword, location, maxPages } = getSearchConfig();
       const requestDelay = getDelay();
       console.log(`Rate limit delay: ${requestDelay}ms between requests`);
       ```

    3. **Update pagination loop (line 34) to use maxPages:**
       ```javascript
       // REPLACE:
       for (let pageNumber = 0; pageNumber < 1000; pageNumber += 25) {
       // WITH:
       let pageNumber = 0;
       let pagesScraped = 0;
       while (true) {
         if (maxPages > 0 && pagesScraped >= maxPages) {
           console.log(`Reached max pages limit (${maxPages})`);
           break;
         }
       ```

    4. **Add delay after each pagination request (after line 37-38):**
       ```javascript
       await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded' });
       console.log(`Rate limiting: waiting ${requestDelay}ms...`);
       await new Promise(resolve => setTimeout(resolve, requestDelay));
       ```

    5. **Add delay after each job link visit (after line 77, inside the for loop):**
       ```javascript
       // Add after saving job data
       if (jobLink !== jobLinks[jobLinks.length - 1]) {
         console.log(`Rate limiting: waiting ${requestDelay}ms...`);
         await new Promise(resolve => setTimeout(resolve, requestDelay));
       }
       ```

    6. **Increment pagesScraped at end of loop iteration and add break condition:**
       ```javascript
       // At the end of the while loop (after line 78):
       pageNumber += 25;
       pagesScraped++;
       } // Close while loop
       ```
  </action>
  <verify>
    <automated>grep -n "Rate limiting" main.js | wc -l</automated>
  </verify>
  <done>Rate limiting delay appears in multiple places</done>
</task>

<task type="auto">
  <name>Task 4: Implement automatic pagination stop when no jobs found</name>
  <files>main.js</files>
  <action>
    Update the pagination logic to stop when no jobs are found:

    1. **After line 52 (getting jobLinks), add check:**
       ```javascript
       const jobLinks = await page.$$eval(jobSelector, links => links.map(link => link.href));
       
       if (jobLinks.length === 0) {
         console.log('No more jobs found. Stopping pagination.');
         break;
       }
       ```

    2. **Remove the hardcoded 1000 limit by updating the while condition:**
       - The while(true) from Task 3 handles this with maxPages
       - The jobLinks.length === 0 check handles empty page detection
  </action>
  <verify>
    <automated>grep -n "No more jobs found" main.js</automated>
  </verify>
  <done>Automatic stop logic when no jobs found</done>
</task>

<task type="auto">
  <name>Task 5: Verify all success criteria</name>
  <files>main.js, config.js</files>
  <action>
    Run verification commands to confirm all success criteria:

    1. Check --max-pages in help:
       ```bash
       node main.js --help
       ```
       Expected: Shows -m, --max-pages option

    2. Check retry function exists:
       ```bash
       grep -n "gotoWithRetry" main.js
       ```
       Expected: Function definition and 2 usages

    3. Check backoff delays:
       ```bash
       grep -n "BACKOFF_DELAYS" main.js
       ```
       Expected: Array [1000, 2000, 4000]

    4. Check rate limiting logs:
       ```bash
       grep -n "Rate limiting" main.js
       ```
       Expected: Multiple log statements

    5. Check max pages logic:
       ```bash
       grep -n "maxPages" main.js
       ```
       Expected: maxPages usage in loop condition

    6. Check empty page detection:
       ```bash
       grep -n "No more jobs found" main.js
       ```
       Expected: Break condition for empty pages
  </action>
  <verify>
    <automated>node main.js --help 2>&1 | grep -q "max-pages" && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>All success criteria verified</done>
</task>

</tasks>

<verification>
## Phase 2 Verification Commands

```bash
# Test 1: --max-pages option exists
node main.js --help
# Expected: Shows -m, --max-pages option

# Test 2: Missing credentials shows error (still works)
node main.js
# Expected: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"

# Test 3: With max-pages flag (won't actually scrape, just verify logic)
LINKEDIN_EMAIL=test@test.com LINKEDIN_PASSWORD=test node main.js --max-pages 2 2>&1 | head -20
# Expected: Starts with rate limit delay logged
```

Manual verification (requires real credentials):
- Run with fewer max pages to test pagination stopping
- Observe retry messages if network timeout occurs
- Verify rate limiting delays between requests
</verification>

<success_criteria>
1. [ ] `node main.js --help` shows -m, --max-pages option
2. [ ] `grep -n "gotoWithRetry" main.js` returns function definition + 2 usages
3. [ ] `grep -n "BACKOFF_DELAYS" main.js` shows [1000, 2000, 4000]
4. [ ] `grep -n "Rate limiting" main.js` shows multiple log statements
5. [ ] `grep -n "No more jobs found" main.js` shows pagination stop logic

**Requirements Coverage:**
- REL-01: ✓ Exponential backoff retry (gotoWithRetry function with BACKOFF_DELAYS)
- REL-02: ✓ Configurable delay (getDelay() + rate limiting logs)
- REL-03: ✓ Pagination stops when no jobs found (empty jobLinks check)
</success_criteria>

<output>
After completion, create `.planning/phases/02-reliability/02-reliability-01-SUMMARY.md`
</output>
