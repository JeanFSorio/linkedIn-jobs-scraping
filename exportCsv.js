const fs = require('fs');
const path = require('path');

function exportToCsv(jobs, filename = null) {
  const exportDir = 'exports';
  
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const filepath = filename || path.join(exportDir, `jobs_${timestamp}.csv`);

  const headers = ['foundAt', 'jobId', 'title', 'company', 'location', 'insight', 'link', 'description', 'match', 'match_words'];
  const csvRows = [headers.join(',')];

  jobs.forEach(job => {
    const row = headers.map(header => {
      const key = header === 'foundAt' ? 'FoundAt' : header.charAt(0).toUpperCase() + header.slice(1);
      const value = job[key] || '';
      // Escape quotes and wrap in quotes if contains comma
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(row.join(','));
  });

  fs.writeFileSync(filepath, csvRows.join('\n'), 'utf8');
  return filepath;
}

module.exports = exportToCsv;
