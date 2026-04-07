const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('jobs.db');

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
  
  console.log('✅ Base table created');
  
  const migrations = [
    { col: 'source', sql: 'ALTER TABLE jobs ADD COLUMN source TEXT' },
    { col: 'job_type', sql: 'ALTER TABLE jobs ADD COLUMN job_type TEXT' },
    { col: 'is_remote', sql: 'ALTER TABLE jobs ADD COLUMN is_remote INTEGER DEFAULT 0' },
    { col: 'date_posted', sql: 'ALTER TABLE jobs ADD COLUMN date_posted TEXT' },
    { col: 'compensation', sql: 'ALTER TABLE jobs ADD COLUMN compensation TEXT' },
    { col: 'emails', sql: 'ALTER TABLE jobs ADD COLUMN emails TEXT' }
  ];
  
  migrations.forEach(({ col, sql }) => {
    db.run(sql, function(err) {
      if (err) {
        if (err.message.includes('duplicate column') || err.message.includes('no such column')) {
          console.log(`Column '${col}' already exists or added`);
        } else {
          console.error(`Error on '${col}':`, err.message);
        }
      } else {
        console.log(`✅ Added column '${col}'`);
      }
    });
  });
});

db.close(() => {
  console.log('\n✅ Database ready!');
});