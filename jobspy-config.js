const { Command } = require('commander');

function getJobSpyConfig() {
  const program = new Command();

  program
    .name('jobspy-bridge.js')
    .description('JobSpy scraper - runs Python jobspy library and saves to database')
    .option('-k, --keyword <value>', 'Search keyword', 'developer')
    .option('-l, --location <value>', 'Search location', '')
    .option('-s, --sites <value>', 'Comma-separated sites', 'google,indeed,glassdoor')
    .option('-r, --results <number>', 'Number of results per site', '15')
    .option('--remote', 'Only fetch remote jobs')
    .option('-d, --days <number>', 'Filter by posting age in days');

  program.parse(process.argv);
  const options = program.opts();

  return {
    keyword: options.keyword,
    location: options.location,
    sites: options.sites,
    results: parseInt(options.results) || 15,
    remote: options.remote || false,
    hoursOld: options.days ? options.days * 24 : null
  };
}

module.exports = { getJobSpyConfig };