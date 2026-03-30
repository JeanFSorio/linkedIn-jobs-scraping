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
    .option('-m, --max-pages <number>', 'Maximum number of pages to scrape (0 = unlimited)', '0');

  program.parse(process.argv);
  const options = program.opts();

  return {
    keyword: options.keyword,
    location: options.location,
    maxPages: parseInt(options.maxPages) || 0
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
