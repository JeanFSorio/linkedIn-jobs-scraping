const puppeteer = require('puppeteer');
const ObjectsToCsv = require('objects-to-csv');
const saveToDb = require('./database.js');

 
linkedinJobs = [];
keyword = 'dotnet developer "pleno"';
locationuri = 'Brazil';

const timeoutDuration = 3000; 

// TODO: for (let pageNumber = 0; pageNumber < 1000; pageNumber += 25) para pegar todos as querrys de todas as paginas
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Your code to login, search for jobs, and scrape job details will go here
  const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';

  await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded' });
  
  const EMAIL_SELECTOR = '#username';
  const PASSWORD_SELECTOR = '#password';
  // const SUBMIT_SELECTOR = '#app__container > main > div:nth-child(2) > form > div.login__form_action_container > button';
  const SUBMIT_SELECTOR = '.btn__primary--large';

  await page.type(EMAIL_SELECTOR, 'yourmail@host.com');
  await page.type(PASSWORD_SELECTOR, 'linkedin_password');
  await page.click(SUBMIT_SELECTOR);
  await page.waitForNavigation({ timeout: 60000 });

  const encodedKeyword = encodeURIComponent(keyword);
  const encodedLocation = encodeURIComponent(locationuri);
  
  for (let pageNumber = 0; pageNumber < 25; pageNumber += 25) {
    const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeyword}&location=${encodedLocation}&position=1&pageNum=0&start=${pageNumber}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000  });

    // const jobSelector = '.job-card-container__link';
    const jobSelector = '.base-card__full-link';
    
    // const descriptionSelector = '.show-more-less-html__markup';
    const DESCRIPTION_SELECTOR = '.jobs-box__html-content > span';
    const TITLE_SELECTOR = '.jobs-unified-top-card__job-title';
    const COMPANY_SELECTOR = '.jobs-unified-top-card__company-name';
    const LOCATION_SELECTOR = '.jobs-unified-top-card__bullet';
    const INSIGHT_SELECTOR = '.jobs-unified-top-card__job-insight span';
    const COMPETENCIES_SELECTOR = 'a.job-details-how-you-match__skills-item-subtitle'
    
    await page.waitForSelector(jobSelector);

    const jobLinks = await page.$$eval(jobSelector, links => links.map(link => link.href));
    for (let jobLink of jobLinks) {
      await page.goto(jobLink, { waitUntil: 'domcontentloaded', timeout: 60000});
    
      try {
        const jobDescription = await page.$eval(DESCRIPTION_SELECTOR, el => el.innerText.replace(/\n{2,}/g, '\n'));
        const jobTitle = await page.$eval(TITLE_SELECTOR, el => el.textContent.trim());
        const company = await page.$eval(COMPANY_SELECTOR, el => el.textContent.trim());
        const location = await page.$eval(LOCATION_SELECTOR, el => el.textContent.trim());
        
        await page.waitForTimeout(2000) // I was getting errors, so I put a wait and it worked somehow
        insight = await page.$eval(INSIGHT_SELECTOR, el => el.textContent.trim());

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
  }

  await browser.close();

  saveToDb(linkedinJobs)

})();