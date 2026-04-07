require('dotenv').config();

const azureConnString = process.env.AZURE_CONNECTION_STRING;
const isAzure = !!azureConnString;

let db = null;
let connectionPromise = null;

async function getDb() {
  if (db) return db;
  
  if (isAzure) {
    console.log('🔵 Using Azure SQL Database');
    const azure = require('./azure-db.js');
    await azure.connectAzure(azureConnString);
    await azure.initAzureTable();
    db = azure;
    return db;
  } else {
    console.log('🟢 Using SQLite (local)');
    db = require('./sqlite-db.js');
    return db;
  }
}

async function saveToDb(jobsArray) {
  const dbInstance = await getDb();
  return dbInstance.saveToDb(jobsArray);
}

async function getNextJobToAnalyze() {
  const dbInstance = await getDb();
  return dbInstance.getNextJobToAnalyze();
}

async function markJobAnalyzed(rowid) {
  const dbInstance = await getDb();
  return dbInstance.markJobAnalyzed(rowid);
}

async function getJobById(jobId) {
  const dbInstance = await getDb();
  return dbInstance.getJobById(jobId);
}

module.exports = {
  saveToDb,
  getNextJobToAnalyze,
  markJobAnalyzed,
  getJobById,
  getDb
};