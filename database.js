const sqlite3 = require('sqlite3').verbose();

function saveToDb(jobsArray) {
  const db = new sqlite3.Database('jobs.db');

  db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS jobs (title TEXT, company TEXT, location TEXT, insight TEXT, link TEXT, description TEXT, requirements TEXT)');

    const stmt = db.prepare('INSERT INTO jobs (title, company, location, insight, link, description) VALUES (?, ?, ?, ?, ?, ?)');

    jobsArray.forEach((job) => {
      stmt.run(job.Title, job.Company, job.Location, job.Insight, job.Link, job.Description);
    });

    stmt.finalize();
  });

  db.close();
}

module.exports = saveToDb;