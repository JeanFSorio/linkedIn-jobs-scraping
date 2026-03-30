const puppeteer = require('puppeteer');
const saveToDb = require('./database.js');
const { getCredentials, getSearchConfig, validateEnvironment, getDelay } = require('./config.js');

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000];

async function gotoWithRetry(page, url, options = {}) {
  const timeout = options.timeout || 60000;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry ${attempt}/${MAX_RETRIES} for ${url} after ${BACKOFF_DELAYS[attempt-1]}ms`);
        await new Promise(resolve => setTimeout(resolve, BACKOFF_DELAYS[attempt-1]));
      }
      await page.goto(url, { ...options, timeout });
      return true;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`Failed after ${MAX_RETRIES} retries: ${url}`);
        throw error;
      }
      console.log(`Timeout on attempt ${attempt + 1}, retrying...`);
    }
  }
}

(async () => {
  // Check for --help before validation
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    const { getSearchConfig } = require('./config.js');
    getSearchConfig();
    return;
  }
  
  // Validate environment and get configuration
  validateEnvironment();
  const { email, password } = getCredentials();
  const { keyword, location, maxPages } = getSearchConfig();
  const requestDelay = getDelay();
  console.log(`Rate limit delay: ${requestDelay}ms between requests`);

  const linkedinJobs = [];
  const timeoutDuration = 3000;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Your code to login, search for jobs, and scrape job details will go here
  const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';

  await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const EMAIL_SELECTOR = '#username';
  const PASSWORD_SELECTOR = '#password';
  // const SUBMIT_SELECTOR = '#app__container > main > div:nth-child(2) > form > div.login__form_action_container > button';
  const SUBMIT_SELECTOR = '.btn__primary--large';

  await page.type(EMAIL_SELECTOR, email);
  await page.type(PASSWORD_SELECTOR, password);
  await page.click(SUBMIT_SELECTOR);
  await page.waitForNavigation({ timeout: 60000 });

  const encodedKeyword = encodeURIComponent(keyword);
  const encodedLocation = encodeURIComponent(location);

  let pageNumber = 0;
  let pagesScraped = 0;
  while (true) {
    if (maxPages > 0 && pagesScraped >= maxPages) {
      console.log(`Reached max pages limit (${maxPages})`);
      break;
    }
    const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeyword}&location=${encodedLocation}&position=1&pageNum=0&start=${pageNumber}`;

    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded' });
    console.log(`Rate limiting: waiting ${requestDelay}ms...`);
    await new Promise(resolve => setTimeout(resolve, requestDelay));

    const jobSelector = '.base-card__full-link';
    const DESCRIPTION_SELECTOR = '.jobs-box__html-content > span';
    const TITLE_SELECTOR = '.jobs-unified-top-card__job-title';
    const COMPANY_SELECTOR = '.jobs-unified-top-card__company-name';
    const LOCATION_SELECTOR = '.jobs-unified-top-card__bullet';
    const INSIGHT_SELECTOR = '.jobs-unified-top-card__job-insight span';

    await page.waitForSelector(jobSelector);

    const jobLinks = await page.$$eval(jobSelector, links => links.map(link => link.href));
    
    if (jobLinks.length === 0) {
      console.log('No more jobs found. Stopping pagination.');
      break;
    }
    
    for (let jobLink of jobLinks) {
      await gotoWithRetry(page, jobLink, { waitUntil: 'domcontentloaded' });
      console.log(`Rate limiting: waiting ${requestDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, requestDelay));

      try {
        const jobDescription = await page.$eval(DESCRIPTION_SELECTOR, el => el.innerText.replace(/\n{2,}/g, '\n'));
        const jobTitle = await page.$eval(TITLE_SELECTOR, el => el.textContent.trim());
        const company = await page.$eval(COMPANY_SELECTOR, el => el.textContent.trim());
        const location = await page.$eval(LOCATION_SELECTOR, el => el.textContent.trim());

        const insight = await page.$eval(INSIGHT_SELECTOR, el => el.textContent.trim());

        linkedinJobs.push({
          'Title': jobTitle,
          'Company': company,
          'Location': location,
          'Insight': insight,
          'Link': jobLink,
          'Description': jobDescription,
        });
        console.log('Job: '+ jobTitle)
      } catch (error) {
        console.log(`Failed to find job description for ${jobLink}/n ${error}`);
      }
    }
    pageNumber += 25;
    pagesScraped++;
  }

  await browser.close();

  saveToDb(linkedinJobs)

})();
