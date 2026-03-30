---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - config.js
  - main.js
autonomous: true
requirements:
  - SEC-01
  - CLI-01
  - CLI-02

must_haves:
  truths:
    - "User can run scraper with LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables set"
    - "User can specify search keyword via --keyword or -k argument"
    - "User can specify location via --location or -l argument"
    - "Missing environment variables produce clear error"
    - "Default keyword ('developer') and location ('Brazil') work when not specified"
  artifacts:
    - path: config.js
      provides: Credential validation and CLI argument parsing
      exports: getCredentials, getSearchConfig, validateEnvironment
    - path: package.json
      provides: commander dependency for CLI parsing
      contains: commander
    - path: main.js
      provides: Updated scraper with secure credentials and CLI arguments
      removes: hardcoded credentials on lines 26-27
      uses: config.js exports
  key_links:
    - from: main.js
      to: config.js
      via: require('./config.js')
      pattern: "const.*config.*=.*require"
    - from: main.js
      to: process.env
      via: getCredentials() call
      pattern: "getCredentials"
---

<objective>
Secure credential management and configurable CLI arguments for the LinkedIn jobs scraper.

Purpose: Remove hardcoded credentials, add CLI flexibility, validate environment setup before running.
Output: config.js module, updated main.js with secure credential loading and CLI arguments.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@main.js
@package.json

## Existing Code Context

**main.js (lines 26-27) - HARDCODED CREDENTIALS TO REMOVE:**
```javascript
await page.type(EMAIL_SELECTOR, 'yourmail@host.com');
await page.type(PASSWORD_SELECTOR, 'linkedin_password');
```

**main.js (lines 7-8) - TO BE REPLACED WITH CLI DEFAULTS:**
```javascript
keyword = 'dotnet developer "pleno"';
locationuri = 'Brazil';
```

**package.json dependencies - ADD commander:**
```json
"dependencies": {
  "commander": "^12.0.0"
}
```
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add commander dependency to package.json</name>
  <files>package.json</files>
  <action>
    Add commander as a dependency to package.json. Use version ^12.0.0 (latest stable).

    - Add "commander" to the dependencies object
    - Run `npm install` to install the new dependency
  </action>
  <verify>
    <automated>npm list commander --depth=0</automated>
  </verify>
  <done>commander appears in npm list output, package-lock.json updated</done>
</task>

<task type="auto">
  <name>Task 2: Create config.js with credential validation and CLI defaults</name>
  <files>config.js</files>
  <action>
    Create a new config.js module that:

    1. **Exports getCredentials():** 
       - Reads LINKEDIN_EMAIL and LINKEDIN_PASSWORD from process.env
       - Returns { email, password } if both exist
       - Throws clear error if missing: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"
       - DO NOT log or expose the actual credentials

    2. **Exports getSearchConfig():**
       - Uses commander to parse CLI arguments
       - Defines --keyword/-k option with default "developer"
       - Defines --location/-l option with default "Brazil"
       - Returns { keyword, location } with applied defaults
       - Handles URL encoding internally for the keyword

    3. **Exports validateEnvironment():**
       - Calls getCredentials()
       - Returns true if valid (for explicit validation when needed)
       - Call this at script startup

    Example usage pattern:
    ```javascript
    const { getCredentials, getSearchConfig, validateEnvironment } = require('./config.js');
    
    validateEnvironment(); // throws on missing credentials
    const { email, password } = getCredentials();
    const { keyword, location } = getSearchConfig();
    ```
  </action>
  <verify>
    <automated>node -e "require('./config.js'); console.log('config.js loads successfully')"</automated>
  </verify>
  <done>config.js exists with getCredentials, getSearchConfig, validateEnvironment exports</done>
</task>

<task type="auto">
  <name>Task 3: Update main.js to use config.js and remove hardcoded credentials</name>
  <files>main.js</files>
  <action>
    Update main.js to:

    1. **Add require at top:**
       ```javascript
       const { getCredentials, getSearchConfig, validateEnvironment } = require('./config.js');
       ```

    2. **Remove global variable declarations (lines 6-8):**
       - Remove: `linkedinJobs = [];`
       - Remove: `keyword = 'dotnet developer "pleno"';`
       - Remove: `locationuri = 'Brazil';`
       - Replace with: `let linkedinJobs = [];`

    3. **Add startup validation** at the beginning of the async IIFE (after line 13):
       ```javascript
       validateEnvironment();
       const { email, password } = getCredentials();
       const { keyword, location } = getSearchConfig();
       ```

    4. **Replace hardcoded credentials (lines 26-27):**
       ```javascript
       // REPLACE:
       await page.type(EMAIL_SELECTOR, 'yourmail@host.com');
       await page.type(PASSWORD_SELECTOR, 'linkedin_password');
       // WITH:
       await page.type(EMAIL_SELECTOR, email);
       await page.type(PASSWORD_SELECTOR, password);
       ```

    5. **Update keyword/location usage:**
       - Line 31: `const encodedKeyword = encodeURIComponent(keyword);` (already correct variable name)
       - Line 32: `const encodedLocation = encodeURIComponent(locationuri);` → change `locationuri` to `location`

    6. **Remove unused imports:**
       - Line 2: Remove `const ObjectsToCsv = require('objects-to-csv');` (will be used in Phase 3)
  </action>
  <verify>
    <automated>node main.js --help 2>&1 | head -20</automated>
  </verify>
  <done>
    - main.js no longer contains hardcoded email/password strings
    - `node main.js --help` shows -k/--keyword and -l/--location options
    - `node main.js` (without env vars) shows error: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"
  </done>
</task>

</tasks>

<verification>
## Phase 1 Verification Commands

```bash
# Test 1: CLI help shows options
node main.js --help
# Expected: Shows -k, --keyword and -l, --location options

# Test 2: Missing credentials shows error
node main.js
# Expected: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"

# Test 3: With env vars set (mock test)
LINKEDIN_EMAIL=test@example.com LINKEDIN_PASSWORD=testpass node main.js --keyword "frontend" --location "São Paulo" 2>&1 | head -5
# Expected: Starts scraping with frontend/São Paulo (will fail at login but that's OK for verification)
```
</verification>

<success_criteria>
1. [ ] `npm list commander` shows commander installed
2. [ ] `node main.js --help` shows --keyword/-k and --location/-l options
3. [ ] `node main.js` without env vars prints: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"
4. [ ] `grep -n "yourmail@host.com\|linkedin_password" main.js` returns no matches (credentials removed)
5. [ ] Running with env vars and CLI args starts the scraper (login will fail with fake creds but that's expected)

**Requirements Coverage:**
- SEC-01: ✓ Credentials via process.env (config.js getCredentials)
- CLI-01: ✓ --keyword/-k argument (config.js getSearchConfig)
- CLI-02: ✓ --location/-l argument (config.js getSearchConfig)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-01-SUMMARY.md`
</output>
