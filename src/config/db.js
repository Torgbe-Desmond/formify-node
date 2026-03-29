const mongoose = require('mongoose');
const logger = require('./logger');

let filesDb = null; // separate connection for file content storage

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.info(`MongoDB connected: ${mongoose.connection.host}`);

  // File content stored in a separate collection (same or different cluster)
  const filesUri = process.env.MONGODB_FILES_URI || uri;
  const conn = await mongoose.createConnection(filesUri, {
    serverSelectionTimeoutMS: 10000,
    dbName: process.env.MONGODB_FILES_DB || 'FastTransfersFiles',
  }).asPromise();

  filesDb = conn;
  logger.info('MongoDB file-content connection ready');

  return { mainDb: mongoose.connection, filesDb: conn };
}

function getFilesDb() {
  if (!filesDb) throw new Error('File content DB not initialised');
  return filesDb;
}

module.exports = { connectDB, getFilesDb };
