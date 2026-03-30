const { Command } = require('commander');

/**
 * Get LinkedIn credentials from environment variables.
 * @returns {{ email: string, password: string }} Credentials object
 * @throws {Error} If credentials are missing
 */
function getCredentials() {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error('LinkedIn credentials required: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD');
  }

  return { email, password };
}

/**
 * Get search configuration from CLI arguments.
 * @returns {{ keyword: string, location: string }} Search config
 */
function getSearchConfig() {
  const program = new Command();

  program
    .name('main.js')
    .description('LinkedIn Jobs Scraping Tool')
    .option('-k, --keyword <value>', 'Search keyword', 'developer')
    .option('-l, --location <value>', 'Search location', 'Brazil');

  program.parse(process.argv);
  const options = program.opts();

  return {
    keyword: options.keyword,
    location: options.location
  };
}

/**
 * Validate that the environment has required credentials.
 * @returns {boolean} True if valid
 * @throws {Error} If credentials are missing
 */
function validateEnvironment() {
  getCredentials();
  return true;
}

module.exports = {
  getCredentials,
  getSearchConfig,
  validateEnvironment
};
