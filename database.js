const sqlite3 = require('sqlite3').verbose();

function saveToDb(jobsArray) {
  const db = new sqlite3.Database('jobs.db');
  let duplicatesSkipped = 0;

  db.serialize(() => {
    // Add UNIQUE constraint on link column to prevent duplicates
    db.run('CREATE TABLE IF NOT EXISTS jobs (title TEXT, company TEXT, location TEXT, insight TEXT, link TEXT UNIQUE, description TEXT, requirements TEXT)');

    const stmt = db.prepare('INSERT OR IGNORE INTO jobs (title, company, location, insight, link, description) VALUES (?, ?, ?, ?, ?, ?)');

    jobsArray.forEach((job) => {
      const result = stmt.run(job.Title, job.Company, job.Location, job.Insight, job.Link, job.Description);
      if (result.changes === 0) {
        duplicatesSkipped++;
      }
    });

    stmt.finalize();
  });

  db.close();
  return duplicatesSkipped;
}

module.exports = saveToDb;