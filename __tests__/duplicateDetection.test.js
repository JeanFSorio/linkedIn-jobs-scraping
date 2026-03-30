const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

function saveToDb(jobsArray, dbPath = 'jobs_test.db') {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    let duplicatesSkipped = 0;

    db.serialize(() => {
      db.run('CREATE TABLE IF NOT EXISTS jobs (title TEXT, company TEXT, location TEXT, insight TEXT, link TEXT UNIQUE, description TEXT)');

      const stmt = db.prepare('INSERT OR IGNORE INTO jobs (title, company, location, insight, link, description) VALUES (?, ?, ?, ?, ?, ?)');

      jobsArray.forEach((job) => {
        stmt.run(job.Title, job.Company, job.Location, job.Insight, job.Link, job.Description, function(err) {
          if (err) {
            reject(err);
          }
          if (this.changes === 0) {
            duplicatesSkipped++;
          }
        });
      });

      stmt.finalize(() => {
        db.close(() => {
          resolve(duplicatesSkipped);
        });
      });
    });
  });
}

describe('Duplicate Detection', () => {
  const testDb = 'jobs_test.db';

  beforeEach(() => {
    if (fs.existsSync(testDb)) {
      fs.unlinkSync(testDb);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDb)) {
      try {
        fs.unlinkSync(testDb);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test('returns 0 when inserting unique jobs', async () => {
    const jobs = [
      { Title: 'Job 1', Company: 'Company A', Location: 'Location 1', Insight: 'Insight 1', Link: 'https://example.com/job1', Description: 'Desc 1' },
      { Title: 'Job 2', Company: 'Company B', Location: 'Location 2', Insight: 'Insight 2', Link: 'https://example.com/job2', Description: 'Desc 2' }
    ];
    const duplicates = await saveToDb(jobs, testDb);
    expect(duplicates).toBe(0);
  });

  test('detects duplicate jobs by link', async () => {
    const jobs = [
      { Title: 'Job 1', Company: 'Company A', Location: 'Location 1', Insight: 'Insight 1', Link: 'https://example.com/job1', Description: 'Desc 1' },
      { Title: 'Job 1 Duplicate', Company: 'Company A', Location: 'Location 1', Insight: 'Insight 1', Link: 'https://example.com/job1', Description: 'Desc 1' }
    ];
    const duplicates = await saveToDb(jobs, testDb);
    expect(duplicates).toBe(1);
  });

  test('counts multiple duplicates correctly', async () => {
    const jobs = [
      { Title: 'Job 1', Company: 'Company A', Location: 'Location 1', Insight: 'Insight 1', Link: 'https://example.com/job1', Description: 'Desc 1' },
      { Title: 'Job 2', Company: 'Company B', Location: 'Location 2', Insight: 'Insight 2', Link: 'https://example.com/job2', Description: 'Desc 2' },
      { Title: 'Job 1', Company: 'Company A', Location: 'Location 1', Insight: 'Insight 1', Link: 'https://example.com/job1', Description: 'Desc 1' },
      { Title: 'Job 2', Company: 'Company B', Location: 'Location 2', Insight: 'Insight 2', Link: 'https://example.com/job2', Description: 'Desc 2' }
    ];
    const duplicates = await saveToDb(jobs, testDb);
    expect(duplicates).toBe(2);
  });
});
