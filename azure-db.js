const mssql = require('mssql');

let pool = null;

async function connectAzure(connectionString) {
  try {
    pool = await mssql.connect(connectionString);
    console.log('✅ Connected to Azure SQL Database');
    return pool;
  } catch (err) {
    console.error('❌ Azure connection failed:', err.message);
    throw err;
  }
}

async function initAzureTable() {
  if (!pool) {
    throw new Error('Not connected to Azure. Call connectAzure first.');
  }

  const createTableSQL = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'jobs')
    BEGIN
      CREATE TABLE jobs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(500),
        company NVARCHAR(500),
        location NVARCHAR(500),
        insight NVARCHAR(MAX),
        link NVARCHAR(1000) UNIQUE,
        description NVARCHAR(MAX),
        requirements NVARCHAR(MAX),
        job_id NVARCHAR(100) UNIQUE,
        found_at NVARCHAR(50),
        match INT,
        match_words NVARCHAR(MAX),
        analyzed INT DEFAULT 0,
        analyzed_at NVARCHAR(50),
        source NVARCHAR(50),
        job_type NVARCHAR(50),
        is_remote INT DEFAULT 0,
        date_posted NVARCHAR(20),
        compensation NVARCHAR(MAX),
        emails NVARCHAR(MAX)
      );
    END
  `;

  try {
    await pool.query(createTableSQL);
    console.log('✅ Azure table ready');
  } catch (err) {
    console.error('Error creating table:', err.message);
    throw err;
  }
}

async function saveToDb(jobsArray) {
  if (!pool) {
    throw new Error('Not connected to Azure. Call connectAzure first.');
  }

  let duplicatesSkipped = 0;
  const now = new Date().toISOString();

  for (const job of jobsArray) {
    try {
      const result = await pool.request()
        .input('title', mssql.VarChar(500), job.title || job.Title || null)
        .input('company', mssql.VarChar(500), job.company || job.Company || null)
        .input('location', mssql.VarChar(500), job.location || job.Location || null)
        .input('insight', mssql.Text, job.insight || job.Insight || null)
        .input('link', mssql.VarChar(1000), job.link || job.Link || null)
        .input('description', mssql.Text, job.description || job.Description || null)
        .input('job_id', mssql.VarChar(100), job.job_id || job.JobId || null)
        .input('found_at', mssql.VarChar(50), now)
        .input('match', mssql.Int, null)
        .input('match_words', mssql.VarChar(2000), null)
        .input('source', mssql.VarChar(50), job.source || null)
        .input('job_type', mssql.VarChar(50), job.job_type || null)
        .input('is_remote', mssql.Int, job.is_remote !== undefined ? job.is_remote : (job.IsRemote ? 1 : 0))
        .input('date_posted', mssql.VarChar(20), job.date_posted || null)
        .input('compensation', mssql.Text, job.compensation || null)
        .input('emails', mssql.Text, job.emails || null)
        .query(`
          INSERT INTO jobs (title, company, location, insight, link, description, job_id, found_at, match, match_words, source, job_type, is_remote, date_posted, compensation, emails)
          SELECT @title, @company, @location, @insight, @link, @description, @job_id, @found_at, @match, @match_words, @source, @job_type, @is_remote, @date_posted, @compensation, @emails
          WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE link = @link)
        `);
    } catch (err) {
      if (err.message.includes('duplicate')) {
        duplicatesSkipped++;
      } else {
        console.error('Error inserting job:', err.message);
      }
    }
  }

  return duplicatesSkipped;
}

async function getNextJobToAnalyze() {
  if (!pool) {
    throw new Error('Not connected to Azure. Call connectAzure first.');
  }

  try {
    const result = await pool.request()
      .input('analyzed', mssql.Int, 0)
      .query(`
        SELECT TOP 1 id, * FROM jobs 
        WHERE (analyzed = 0 OR analyzed IS NULL) 
        AND match > 0 
        ORDER BY match DESC
      `);
    
    return result.recordset[0] || null;
  } catch (err) {
    console.error('Error getting next job:', err.message);
    throw err;
  }
}

async function markJobAnalyzed(rowid) {
  if (!pool) {
    throw new Error('Not connected to Azure. Call connectAzure first.');
  }

  const now = new Date().toISOString();

  try {
    const result = await pool.request()
      .input('id', mssql.Int, rowid)
      .input('now', mssql.VarChar(50), now)
      .query('UPDATE jobs SET analyzed = 1, analyzed_at = @now WHERE id = @id');
    
    return result.rowsAffected[0];
  } catch (err) {
    console.error('Error marking job analyzed:', err.message);
    throw err;
  }
}

async function getJobById(jobId) {
  if (!pool) {
    throw new Error('Not connected to Azure. Call connectAzure first.');
  }

  try {
    const result = await pool.request()
      .input('job_id', mssql.VarChar(100), jobId)
      .query('SELECT id, * FROM jobs WHERE job_id = @job_id');
    
    return result.recordset[0] || null;
  } catch (err) {
    console.error('Error getting job by id:', err.message);
    throw err;
  }
}

async function closeAzure() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('🔌 Azure connection closed');
  }
}

function getPool() {
  return pool;
}

module.exports = {
  connectAzure,
  initAzureTable,
  saveToDb,
  getNextJobToAnalyze,
  markJobAnalyzed,
  getJobById,
  closeAzure,
  getPool
};