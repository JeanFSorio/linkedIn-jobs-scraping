const sqlite3 = require('sqlite3').verbose();

function migrateDatabase() {
  const db = new sqlite3.Database('jobs.db');
  
  const migrations = [
    { col: 'source', sql: 'ALTER TABLE jobs ADD COLUMN source TEXT' },
    { col: 'job_type', sql: 'ALTER TABLE jobs ADD COLUMN job_type TEXT' },
    { col: 'is_remote', sql: 'ALTER TABLE jobs ADD COLUMN is_remote INTEGER DEFAULT 0' },
    { col: 'date_posted', sql: 'ALTER TABLE jobs ADD COLUMN date_posted TEXT' },
    { col: 'compensation', sql: 'ALTER TABLE jobs ADD COLUMN compensation TEXT' },
    { col: 'emails', sql: 'ALTER TABLE jobs ADD COLUMN emails TEXT' }
  ];
  
  db.serialize(() => {
    migrations.forEach(({ col, sql }) => {
      db.run(sql, function(err) {
        if (err) {
          if (err.message.includes('duplicate column')) {
            console.log(`Column '${col}' already exists, skipping`);
          } else {
            console.error(`Error adding column '${col}':`, err.message);
          }
        } else {
          console.log(`✅ Added column '${col}'`);
        }
      });
    });
  });
  
  db.close(() => {
    console.log('\nMigration complete!');
  });
}

migrateDatabase();