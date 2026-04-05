const sqlite3 = require('sqlite3').verbose();

function saveToDb(jobsArray) {
  const db = new sqlite3.Database('jobs.db');
  let duplicatesSkipped = 0;
  const now = new Date().toISOString();

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
      analyzed_at TEXT
    )`);

    db.run(`ALTER TABLE jobs ADD COLUMN found_at TEXT`, function(err) {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
        // Ignore
      }
    });
    
    db.run(`ALTER TABLE jobs ADD COLUMN match INTEGER`, function(err) {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
        // Ignore
      }
    });
    
    db.run(`ALTER TABLE jobs ADD COLUMN match_words TEXT`, function(err) {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
        // Ignore
      }
    });

    db.run(`ALTER TABLE jobs ADD COLUMN analyzed INTEGER DEFAULT 0`, function(err) {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
        // Ignore
      }
    });
    
    db.run(`ALTER TABLE jobs ADD COLUMN analyzed_at TEXT`, function(err) {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
        // Ignore
      }
    });

    // Update existing jobs with found_at = now if null (first time found)
    db.run(`UPDATE jobs SET found_at = ? WHERE found_at IS NULL`, [now], function(err) {
      // Ignore errors
    });

    const stmt = db.prepare('INSERT OR IGNORE INTO jobs (title, company, location, insight, link, description, job_id, found_at, match, match_words) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    jobsArray.forEach((job) => {
      const result = stmt.run(
        job.Title, 
        job.Company, 
        job.Location, 
        job.Insight, 
        job.Link, 
        job.Description, 
        job.JobId || null,
        now,  // found_at - current timestamp
        null,
        null
      );
      if (result.changes === 0) {
        duplicatesSkipped++;
      }
    });

    stmt.finalize();
  });

  db.close();
  return duplicatesSkipped;
}

function getNextJobToAnalyze() {
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

function markJobAnalyzed(rowid) {
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

function getJobById(jobId) {
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