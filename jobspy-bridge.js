const { spawn } = require('child_process');
const path = require('path');
const { saveToDb } = require('./database.js');

function runJobSpy(args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'run_jobspy.py');
    
    const pythonProcess = spawn('python', [
      scriptPath,
      '--sites', args.sites,
      '--keyword', args.keyword,
      '--location', args.location || '',
      '--results', args.results || 15,
      ...(args.remote ? ['--remote'] : []),
      ...(args.hoursOld ? ['--hours-old', args.hoursOld.toString()] : [])
    ], { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('JobSpy Error:', stderr);
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }

      try {
        const jobs = JSON.parse(stdout);
        console.log(`JobSpy returned ${jobs.length} jobs`);
        resolve(jobs);
      } catch (parseError) {
        console.error('Failed to parse JobSpy output:', stdout);
        reject(parseError);
      }
    });
  });
}

async function executeJobSpy(args) {
  try {
    console.log(`Running JobSpy with sites: ${args.sites}, keyword: "${args.keyword}"`);
    
    const jobs = await runJobSpy(args);
    
    if (jobs.length === 0) {
      console.log('No jobs found');
      return 0;
    }

    const duplicates = await saveToDb(jobs);
    console.log(`Saved ${jobs.length} jobs (${duplicates} duplicates skipped)`);
    
    return jobs.length;
  } catch (error) {
    console.error('JobSpy execution failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const parsed = {
    sites: 'google,indeed,glassdoor',
    keyword: 'developer',
    location: '',
    results: 15,
    remote: false,
    hoursOld: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sites' && args[i + 1]) parsed.sites = args[++i];
    else if (args[i] === '--keyword' && args[i + 1]) parsed.keyword = args[++i];
    else if (args[i] === '--location' && args[i + 1]) parsed.location = args[++i];
    else if (args[i] === '--results' && args[i + 1]) parsed.results = parseInt(args[++i]);
    else if (args[i] === '--remote') parsed.remote = true;
    else if (args[i] === '--hours-old' && args[i + 1]) parsed.hoursOld = parseInt(args[++i]);
  }

  executeJobSpy(parsed)
    .then(count => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runJobSpy, executeJobSpy };