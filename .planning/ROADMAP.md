# Roadmap

**Phases:** 4  
**Granularity:** Standard  
**Coverage:** 9/9 requirements mapped

---

## Phases

- [x] **Phase 1: Foundation** - Secure credentials and CLI interface
- [ ] **Phase 2: Reliability** - Error handling, rate limiting, pagination control
- [ ] **Phase 3: Data Quality** - Duplicate detection and CSV export
- [ ] **Phase 4: Quality Assurance** - Test coverage

---

## Phase Details

### Phase 1: Foundation

**Goal:** Secure credential management and configurable CLI arguments

**Depends on:** Nothing (first phase)

**Requirements:** SEC-01, CLI-01, CLI-02

**Success Criteria** (what must be TRUE):
1. User can run scraper with `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` environment variables set
2. User can specify search keyword via `--keyword` or `-k` argument
3. User can specify location via `--location` or `-l` argument
4. Missing environment variables produce clear error: "LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD"
5. Default keyword ("developer") and location ("Brazil") work when not specified

**Plans:** 1 plan

Plans:
- [ ] 01-foundation-01-PLAN.md — Secure credentials and CLI arguments

---

### Phase 2: Reliability

**Goal:** Production-ready scraping with graceful error handling and rate limiting

**Depends on:** Phase 1

**Requirements:** REL-01, REL-02, REL-03

**Success Criteria** (what must be TRUE):
1. Network timeouts retry up to 3 times with exponential backoff (1s, 2s, 4s)
2. Each request waits configured delay (default 2s) between page loads
3. Pagination stops automatically when no jobs found on page
4. Log output shows retry attempts and rate limit delays
5. Max pages can be overridden via `--max-pages` argument

**Plans:** TBD

---

### Phase 3: Data Quality

**Goal:** Clean data with duplicate prevention and export capability

**Depends on:** Phase 2

**Requirements:** DATA-01, DATA-02

**Success Criteria** (what must be TRUE):
1. Jobs with duplicate links are not inserted into database twice
2. Console reports "Skipped X duplicate jobs" after scraping
3. `--export-csv` flag exports all jobs to timestamped CSV file
4. CSV contains all fields: title, company, location, insight, link, description
5. CSV file saved to `exports/jobs_YYYYMMDD_HHMMSS.csv`

**Plans:** TBD

---

### Phase 4: Quality Assurance

**Goal:** Verified functionality with automated test coverage

**Depends on:** Phase 3

**Requirements:** TEST-01

**Success Criteria** (what must be TRUE):
1. `npm test` runs all tests and reports results
2. Tests cover URL encoding of keywords and locations
3. Tests verify credential validation rejects missing credentials
4. Tests verify duplicate detection logic
5. Tests verify CLI argument parsing

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-03-30 |
| 2. Reliability | 1/3 | In progress | - |
| 3. Data Quality | 0/2 | Not started | - |
| 4. Quality Assurance | 0/1 | Not started | - |

---

## Dependencies Graph

```
Phase 1 (Foundation)
    │
    └──────────────────────────────┐
                                  ▼
                        Phase 2 (Reliability)
                                  │
                                  ▼
                        Phase 3 (Data Quality)
                                  │
                                  ▼
                        Phase 4 (Quality Assurance)
```

---

*Last updated: 2026-03-30*
