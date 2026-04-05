require('dotenv').config();

const puppeteer = require('puppeteer');
const { saveToDb } = require('./database.js');
const exportToCsv = require('./exportCsv.js');
const { getCredentials, getSearchConfig, validateEnvironment, getDelay } = require('./config.js');

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000];

// Seletores para lista de vagas
const JOB_SELECTOR = '.base-card__full-link';

// Extrai o ID numérico da URL do LinkedIn Jobs
function extractJobId(url) {
  // Padrão: https://www.linkedin.com/jobs/view/...-ID ou .../ID
  // Ex: https://www.linkedin.com/jobs/view/desenvolvedor-net-at-4df-connect-4308519625
  // Ex: https://www.linkedin.com/jobs/view/desenvolvedor-net-at-4df-connect-4308519625/?refId=xxx
  const match = url.match(/(?:\/|-)(\d+)(?:\/|\?|$)/);
  return match ? match[1] : null;
}

// Normaliza a URL removendo query parameters e hash
function normalizeLink(url) {
  try {
    const urlObj = new URL(url);
    // Remove search (query parameters) e hash
    urlObj.search = '';
    urlObj.hash = '';
    return urlObj.toString();
  } catch (e) {
    // Fallback para regex se URL parsing falhar
    return url.split(/[?#]/)[0];
  }
}

// Múltiplos seletores candidatos para cada campo da vaga
const SELECTORS = {
  description: [
    '[data-testid="expandable-text-box"]',
    '.jobs-description-content__text',
    '.jobs-description__content',
    'div[data-job-description]',
    '.job-details__content',
    '.jobs-description',
    'div.jobs-description',
    '.jobs-box__html-content',
    'div[data-testid*="description"]'
  ],
  title: [
    'h1[data-testid="job-title"]',
    '.jobs-unified-top-card__job-title',
    '.job-title',
    'h1',
    '.jobs-details__job-title',
    '.job-details__title',
    '.job-title-text',
    // Específico: parágrafo que contém título + localização
    'p._8d5be5b1._12486a17._99e77017',
    'p[data-testid="job-details-job-title"]'
  ],
  company: [
    '.jobs-unified-top-card__company-name',
    '.company-name',
    '[data-testid="company-name"]',
    '.jobs-details__company-name',
    'a[data-testid="company-name"]',
    'a[href*="/company/"]',
    '[data-testid*="company"]',
    '.job-details__company-name a',
    '.jobs-unified-top-card__company-name-link',
    // Específico: aria-label contendo "Empresa"
    '[aria-label*="Empresa"]',
    '[aria-label*="Company"]'
  ],
  location: [
    '.jobs-unified-top-card__bullet',
    '.job-location',
    '[data-testid="job-location"]',
    '.jobs-details__job-location',
    '.jobs-details__job-info span',
    '.jobs-details__job-info li',
    '[data-testid*="location"]',
    '.jobs-unified-top-card__metadata-list li',
    // Extrair do título (junto com vírgula)
    '.job-details__subtitle',
    '.jobs-unified-top-card__subtitle'
  ],
  insight: [
    '.jobs-unified-top-card__job-insight span',
    '.job-insight',
    '[data-testid="job-insight"]',
    '.jobs-details__job-insight',
    '.jobs-unified-top-card__subtitle',
    '.job-details__subtitle',
    '[data-testid*="insight"]',
    '.jobs-unified-top-card__metadata .job-info-line'
  ]
};

// Função utilitária para testar múltiplos seletores
async function trySelectors(page, selectorList) {
  for (const selector of selectorList) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await page.$eval(selector, el => el.textContent.trim());
        if (text) return text;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

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
    const { keyword, location, maxPages, initialPage, daysFilter, exportCsv, remoteOnly } = getSearchConfig();
    const requestDelay = getDelay();
    console.log(`Rate limit delay: ${requestDelay}ms between requests`);
    console.log(`Remote only filter: ${remoteOnly ? 'YES (f_WT=2)' : 'NO'}`);
    console.log(`Starting from page: ${initialPage}, max pages: ${maxPages > 0 ? maxPages : 'unlimited'}`);
    if (daysFilter) {
      const days = parseInt(daysFilter.replace('r', '')) / 86400;
      console.log(`Days filter: last ${days} days`);
    }

   const linkedinJobs = [];
   const timeoutDuration = 3000;

    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';

    await page.goto(LINKEDIN_LOGIN_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Espera para garantir que a página carregou
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Múltiplos seletores para login (LinkedIn pode mudar)
    const EMAIL_SELECTORS = ['#username', 'input[name="session_key"]', 'input[type="email"]', 'input[autocomplete="username"]'];
    const PASSWORD_SELECTORS = ['#password', 'input[name="session_password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'];
    const SUBMIT_SELECTORS = ['.btn__primary--large', 'button[type="submit"]', 'input[type="submit"]', '.login__form_action_container button'];

    // Encontrar e preencher email
    let emailInput = null;
    for (const selector of EMAIL_SELECTORS) {
      try {
        emailInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (emailInput) {
          await page.type(selector, email, { delay: 100 });
          break;
        }
      } catch (e) {}
    }
    
    if (!emailInput) {
      throw new Error('Could not find email input field. Selectors tried: ' + EMAIL_SELECTORS.join(', '));
    }

    // Encontrar e preencher senha
    let passwordInput = null;
    for (const selector of PASSWORD_SELECTORS) {
      try {
        passwordInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (passwordInput) {
          await page.type(selector, password, { delay: 100 });
          break;
        }
      } catch (e) {}
    }
    
    if (!passwordInput) {
      throw new Error('Could not find password input field. Selectors tried: ' + PASSWORD_SELECTORS.join(', '));
    }

    // Clicar no botão de submit
    let submitButton = null;
    for (const selector of SUBMIT_SELECTORS) {
      try {
        submitButton = await page.waitForSelector(selector, { timeout: 3000 });
        if (submitButton) {
          await page.click(selector);
          break;
        }
      } catch (e) {}
    }
    
    if (!submitButton) {
      throw new Error('Could not find submit button. Selectors tried: ' + SUBMIT_SELECTORS.join(', '));
    }

    // Esperar navegação após login
    try {
      await page.waitForNavigation({ 
        timeout: 45000,
        waitUntil: 'domcontentloaded'
      });
    } catch (navError) {
      console.warn('Navigation timeout after login, checking if we are logged in...');
    }

    // Verificar se login foi bem-sucedido (esperar por algum elemento da página inicial)
    try {
      await page.waitForSelector('div[data-testid="global-nav"]', { timeout: 10000 });
      console.log('✅ Login successful - global navigation found');
    } catch (e) {
      // Talvez há um captcha ou verificação
      console.warn('⚠️ Could not verify login.可能存在验证码或额外验证步骤。');
      // Salvar screenshot para debug
      await page.screenshot({ path: 'login_failed.png', fullPage: true });
      console.log('Screenshot saved as login_failed.png');
    }

   const encodedKeyword = encodeURIComponent(keyword);
   const encodedLocation = encodeURIComponent(location);

    let pageNumber = initialPage * 25;
    let pagesScraped = 0;
    while (true) {
      if (maxPages > 0 && pagesScraped >= maxPages) {
        console.log(`Reached max pages limit (${maxPages})`);
        break;
      }
      
      // Build URL with filters
      let filters = '';
      if (remoteOnly) filters += '&f_WT=2';
      if (daysFilter) filters += `&f_TPR=${daysFilter}`;
      
      const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeyword}&location=${encodedLocation}&position=1&pageNum=0&start=${pageNumber}${filters}`;

      console.log(`📄 Scraping page ${initialPage + pagesScraped} (start=${pageNumber})...`);
      console.log(`🔗 URL: ${searchUrl}`);

      await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded' });
      console.log(`Rate limiting: waiting ${requestDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, requestDelay));

      await page.waitForSelector(JOB_SELECTOR);

      const jobLinks = await page.$$eval(JOB_SELECTOR, links => links.map(link => link.href));
     
     if (jobLinks.length === 0) {
       console.log('No more jobs found. Stopping pagination.');
       break;
      }
      
        for (let jobLink of jobLinks) {
          console.log(`🔗 Job URL: ${jobLink}`);
          await gotoWithRetry(page, jobLink, { waitUntil: 'domcontentloaded' });
          console.log(`Rate limiting: waiting ${requestDelay}ms...`);
         await new Promise(resolve => setTimeout(resolve, requestDelay));

         try {
           // Extrair título com múltiplas estratégias
           let jobTitle = await trySelectors(page, SELECTORS.title);
           
           // Fallback 1: page.title()
           if (!jobTitle) {
             const pageTitle = await page.title();
             jobTitle = pageTitle
               .replace(/\s*\|\s*LinkedIn$/, '')
               .replace(/\s+at\s+[^|]+$/, '')
               .replace(/\s+\|[^|]+$/, '')
               .trim();
           }
           
           // Fallback 2: meta og:title
           if (!jobTitle) {
             try {
               jobTitle = await page.$eval('meta[property="og:title"]', el => el.content.replace(/\s*\|\s*LinkedIn$/, '').trim());
             } catch (e) {}
           }
           
           const jobDescription = await trySelectors(page, SELECTORS.description);
           const company = await trySelectors(page, SELECTORS.company);
           const location = await trySelectors(page, SELECTORS.location);
           const insight = await trySelectors(page, SELECTORS.insight);
           
           // DEBUG: Log para verificar extração
           console.log(`  📊 Extracted - Title: "${jobTitle || 'NULL'}", Company: "${company || 'NULL'}", Location: "${location || 'NULL'}", Insight: "${insight || 'NULL'}"`);
           
           if (!jobTitle) {
             console.warn(`⚠️  Could not extract title for ${jobLink}`);
             console.log(`Page title was: ${await page.title()}`);
           }
           
           // Extrair ID e normalizar URL
           const jobId = extractJobId(jobLink);
           const normalizedLink = normalizeLink(jobLink);
           
           linkedinJobs.push({
             'JobId': jobId,
             'Title': jobTitle || 'N/A',
             'Company': company || 'N/A',
             'Location': location || 'N/A',
             'Insight': insight || 'N/A',
             'Link': normalizedLink,
             'Description': jobDescription || '',
           });
           console.log('Job: ' + (jobTitle || 'Sem título') + (jobId ? ` (ID: ${jobId})` : ''));
         } catch (error) {
           console.log(`Failed to scrape job ${jobLink}: ${error.message}`);
         }
       }
     pageNumber += 25;
     pagesScraped++;
   }

   await browser.close();

   const duplicatesSkipped = saveToDb(linkedinJobs);
   console.log(`Skipped ${duplicatesSkipped} duplicate jobs`);

   if (exportCsv) {
     const filepath = exportToCsv(linkedinJobs);
     console.log(`Exported jobs to ${filepath}`);
   }

})();
