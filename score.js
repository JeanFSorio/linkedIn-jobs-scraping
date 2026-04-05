require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

// Parse KEYWORDS from .env with weights
// Format: "(.net, dotnet):2;(C#,c-sharp, csharp):3;(typescript, ts):1"
function parseKeywordsWithWeights(keywordsStr) {
  if (!keywordsStr) return [];
  
  const groups = keywordsStr.split(';').filter(g => g.trim());
  const result = [];
  let totalWeight = 0;
  
  groups.forEach(group => {
    // Match format: (palavras):peso
    const match = group.match(/^\((.*?)\)(?::|^)(\d*)$/);
    if (match) {
      const words = match[1].split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      const weight = parseInt(match[2]) || 1;
      result.push({ words, weight });
      totalWeight += weight;
    } else {
      // Fallback: old format without weight (weight = 1)
      const simpleMatch = group.match(/^\((.*)\)$/);
      if (simpleMatch) {
        const words = simpleMatch[1].split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        result.push({ words, weight: 1 });
        totalWeight += 1;
      }
    }
  });
  
  return { groups: result.filter(g => g.words.length > 0), totalWeight };
}

// Calculate match percentage and matched words with weights
function calculateMatch(text, keywordGroups, totalWeight) {
  if (!text || keywordGroups.length === 0 || totalWeight === 0) {
    return { match: null, matchWords: [] };
  }

  const searchText = text.toLowerCase();
  let score = 0;
  const matchedWords = new Set();

  keywordGroups.forEach(group => {
    const groupMatched = group.words.some(keyword => {
      if (searchText.includes(keyword)) {
        matchedWords.add(keyword);
        return true;
      }
      return false;
    });
    if (groupMatched) {
      score += group.weight;
    }
  });

  const matchPercentage = Math.round((score / totalWeight) * 100);
  
  return {
    match: matchPercentage,
    matchWords: Array.from(matchedWords)
  };
}

(async () => {
  const keywordsStr = process.env.KEYWORDS;
  if (!keywordsStr) {
    console.error('❌ KEYWORDS not set in .env file');
    console.log('Example format: KEYWORDS="(.net, dotnet):2;(C#, c-sharp, csharp):3;(typescript, ts):1"');
    process.exit(1);
  }

  const { groups: keywordGroups, totalWeight } = parseKeywordsWithWeights(keywordsStr);
  
  console.log(`📊 Loaded ${keywordGroups.length} keyword groups:`);
  keywordGroups.forEach((group, idx) => {
    console.log(`   Group ${idx + 1} (weight ${group.weight}): [${group.words.join(', ')}]`);
  });
  console.log(`   Total weight: ${totalWeight}`);
  console.log('');

  if (totalWeight === 0) {
    console.error('❌ No valid keyword groups found');
    process.exit(1);
  }

  const db = new sqlite3.Database('jobs.db');
  
  db.serialize(() => {
    // Select jobs where match is NULL
    db.all('SELECT rowid, title, description FROM jobs WHERE match IS NULL', (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        db.close();
        process.exit(1);
      }

      console.log(`🎯 Found ${rows.length} jobs to score:`);

      let updated = 0;
      let errors = 0;

      rows.forEach(job => {
        try {
          // Combine title and description for matching
          const combinedText = `${job.title || ''} ${job.description || ''}`;
          const result = calculateMatch(combinedText, keywordGroups, totalWeight);
          
          const stmt = db.prepare('UPDATE jobs SET match = ?, match_words = ? WHERE rowid = ?');
          stmt.run(result.match, result.matchWords.join(','), job.rowid, function(updateErr) {
            if (updateErr) {
              console.error(`❌ Error updating job ${job.rowid}:`, updateErr.message);
              errors++;
            } else {
              if (result.match > 0) {
                console.log(`  ✅ Job ${job.rowid}: ${result.match}% - ${job.title.substring(0, 50)}... (${result.matchWords.join(', ')})`);
              }
              updated++;
            }
          });
          stmt.finalize();
        } catch (e) {
          console.error(`❌ Error processing job ${job.rowid}:`, e.message);
          errors++;
        }
      });

      // Wait for all updates to complete
      setTimeout(() => {
        db.close();
        console.log('');
        console.log(`✅ Scoring complete!`);
        console.log(`   Total processed: ${rows.length}`);
        console.log(`   Successfully updated: ${updated}`);
        console.log(`   Errors: ${errors}`);
      }, 2000);
    });
  });
})();
