/**
 * FileContentService
 * Stores and retrieves raw HTML file content in a dedicated MongoDB collection.
 * StorageKey = MongoDB ObjectId string (matches the spec's "MongoDB" provider).
 */

const { getFilesDb } = require('../config/db');
const mongoose = require('mongoose');

const COLLECTION = process.env.MONGODB_FILES_COLLECTION || 'fileContents';

function getCollection() {
  return getFilesDb().collection(COLLECTION);
}

/**
 * Upload (insert) content. Returns the new ObjectId string as the storageKey.
 */
async function uploadContent(content) {
  const col = getCollection();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    content: content || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(doc);
  return doc._id.toString();
}

/**
 * Download content by storageKey (ObjectId string).
 */
async function downloadContent(storageKey) {
  const col = getCollection();
  const doc = await col.findOne({ _id: new mongoose.Types.ObjectId(storageKey) });
  if (!doc) return null;
  return doc.content;
}

/**
 * Update existing content in place.
 */
async function updateContent(storageKey, content) {
  const col = getCollection();
  await col.updateOne(
    { _id: new mongoose.Types.ObjectId(storageKey) },
    { $set: { content, updatedAt: new Date() } }
  );
}

/**
 * Delete content by storageKey.
 */
async function deleteContent(storageKey) {
  const col = getCollection();
  await col.deleteOne({ _id: new mongoose.Types.ObjectId(storageKey) });
}

module.exports = { uploadContent, downloadContent, updateContent, deleteContent };
