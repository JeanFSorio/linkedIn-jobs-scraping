const sqlite3 = require('sqlite3').verbose();

function saveToDb(jobsArray) {
  const db = new sqlite3.Database('jobs.db');
  let duplicatesSkipped = 0;
  const now = new Date().toISOString();

  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS jobs (
        title TEXT,
        company TEXT, 
        location TEXT,
        insight TEXT,
        link TEXT UNIQUE,
        description TEXT,
        requirements TEXT,
        job_id TEXT UNIQUE,
        found_at TEXT,
        match INTEGER,
        match_words TEXT,
        analyzed INTEGER DEFAULT 0,
        analyzed_at TEXT,
        source TEXT,
        job_type TEXT,
        is_remote INTEGER DEFAULT 0,
        date_posted TEXT,
        compensation TEXT,
        emails TEXT
      )`);

      db.run(`UPDATE jobs SET found_at = ? WHERE found_at IS NULL`, [now], function(err) {});

      const stmt = db.prepare('INSERT OR IGNORE INTO jobs (title, company, location, insight, link, description, job_id, found_at, match, match_words, source, job_type, is_remote, date_posted, compensation, emails) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

      jobsArray.forEach((job) => {
        const result = stmt.run(
          job.title || job.Title, 
          job.company || job.Company, 
          job.location || job.Location, 
          job.insight || job.Insight, 
          job.link || job.Link, 
          job.description || job.Description, 
          job.job_id || job.JobId || null,
          now,
          null,
          null,
          job.source || null,
          job.job_type || null,
          job.is_remote !== undefined ? job.is_remote : (job.IsRemote ? 1 : 0),
          job.date_posted || null,
          job.compensation || null,
          job.emails || null
        );
        if (result.changes === 0) {
          duplicatesSkipped++;
        }
      });

      stmt.finalize(() => {
        db.close(() => {
          resolve(duplicatesSkipped);
        });
      });
    });
  });
}

async function getNextJobToAnalyze() {
  const db = new sqlite3.Database('jobs.db');
  
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT rowid, * FROM jobs 
      WHERE (analyzed = 0 OR analyzed IS NULL) 
      AND match > 0 
      ORDER BY match DESC 
      LIMIT 1
    `, [], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function markJobAnalyzed(rowid) {
  const db = new sqlite3.Database('jobs.db');
  const now = new Date().toISOString();
  
  return new Promise((resolve, reject) => {
    db.run('UPDATE jobs SET analyzed = 1, analyzed_at = ? WHERE rowid = ?', [now, rowid], function(err) {
      db.close();
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

async function getJobById(jobId) {
  const db = new sqlite3.Database('jobs.db');
  
  return new Promise((resolve, reject) => {
    db.get('SELECT rowid, * FROM jobs WHERE job_id = ?', [jobId], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });
}

module.exports = { saveToDb, getNextJobToAnalyze, markJobAnalyzed, getJobById };