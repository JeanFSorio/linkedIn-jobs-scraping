# AGENTS.md

## Required Setup
- Copy `.env.example` to `.env` and set `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD`
- Run `npm install`

## Commands
```bash
npm start                    # Run scraper with defaults (keyword: "developer", location: "Brazil")
npm start -- -k "python"    # Custom keyword
npm start -- -m 5           # Scrape 5 pages max
npm start -- -r             # Remote-only jobs
npm start -- --export-csv   # Export to CSV
npm test                    # Run Jest tests
npm run score               # Score jobs in database
npm run analyze            # Analyze jobs via OpenRouter API
```

## CLI Options
- `-k, --keyword` - Search keyword (default: "developer")
- `-l, --location` - Search location (default: "Brazil")
- `-m, --max-pages` - Max pages (0=unlimited, default: 0)
- `-i, --initial-page` - Starting page (default: 0)
- `-d, --days` - Filter by posting age in days
- `-e, --export-csv` - Export results to CSV
- `-r, --remote-only` - Filter remote jobs only

## Architecture
- **main.js** - Puppeteer scraper, login + pagination
- **database.js** - SQLite storage (`jobs.db`)
- **score.js** - Keyword matching/score calculation
- **config.js** - CLI parsing + env validation

## Notes
- Rate limiting: set `REQUEST_DELAY_MS` in env (default 2000ms)
- Uses headless Puppeteer (`--no-sandbox`)
- Tests are in `__tests__/` and use Jest