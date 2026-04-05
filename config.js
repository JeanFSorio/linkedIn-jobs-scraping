const { Command } = require('commander');

function getCredentials() {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error('LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD');
  }

  return { email, password };
}

function getSearchConfig() {
  const program = new Command();

  program
    .name('main.js')
    .description('LinkedIn Jobs Scraping Tool')
    .option('-k, --keyword <value>', 'Search keyword', 'developer')
    .option('-l, --location <value>', 'Search location', 'Brazil')
    .option('-m, --max-pages <number>', 'Maximum number of pages to scrape (0 = unlimited)', '0')
    .option('-i, --initial-page <number>', 'Starting page number (default: 0)', '0')
    .option('-d, --days <number>', 'Filter by posting age in days (e.g., 7 for last week)')
    .option('-e, --export-csv', 'Export results to CSV file')
    .option('-r, --remote-only', 'Only fetch remote job postings (adds f_WT=2 filter)');

  program.parse(process.argv);
  const options = program.opts();

  // Converter dias para formato do LinkedIn (f_TPR=r{segundos})
  let daysFilter = null;
  if (options.days) {
    const days = parseInt(options.days);
    if (days > 0) {
      const seconds = days * 24 * 60 * 60;
      daysFilter = `r${seconds}`; // formato: r86400 = último dia
    }
  }

  return {
    keyword: options.keyword,
    location: options.location,
    maxPages: parseInt(options.maxPages) || 0,
    initialPage: parseInt(options.initialPage) || 0,
    daysFilter: daysFilter,
    exportCsv: options.exportCsv || false,
    remoteOnly: options.remoteOnly || false
  };
}

function getDelay() {
  return parseInt(process.env.REQUEST_DELAY_MS) || 2000;
}

function validateEnvironment() {
  getCredentials();
  return true;
}

module.exports = {
  getCredentials,
  getSearchConfig,
  validateEnvironment,
  getDelay
};
