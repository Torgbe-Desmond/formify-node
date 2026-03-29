const { body, param } = require('express-validator');
const { Folder, Project, AppFile } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const fileStorage = require('../services/fileStorage.service');

// ─── Validators ──────────────────────────────────────────────────────────────
const createFileRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 500 }),
  body('content').optional().isString(),
  body('metadata').optional(),
  validate,
];

const updateFileRules = [
  body('name').optional().trim().isLength({ max: 500 }),
  body('content').optional().isString(),
  body('metadata').optional(),
  validate,
];

const folderIdParam = [
  param('folderId').isMongoId().withMessage('Invalid folderId'),
  validate,
];

const idParam = [
  param('id').isMongoId().withMessage('Invalid file id'),
  validate,
];

// ─── Metadata helpers ─────────────────────────────────────────────────────────

/**
 * Convert the stored array [{ key, value }] → plain object { key: jsonString }
 *
 * The frontend (EditFileDataDialog) accesses metadata as:
 *   const existingMeta = file.metadata || {};
 *   JSON.parse(existingMeta[key])
 *
 * So the response must look like:
 *   { reporterName: '"Desmond"', challenges: '[]', rank: '"Software "' }
 */
function metadataToObject(metadataArray) {
  if (!metadataArray || metadataArray.length === 0) return {};
  // Use Array.from + explicit property access instead of destructuring.
  // Mongoose DocumentArray subdocuments carry extra internal fields that
  // can cause destructuring to silently produce undefined keys.
  return Object.fromEntries(
    Array.from(metadataArray).map((m) => [m.key, m.value])
  );
}

/**
 * Normalise whatever the frontend sends into [{ key, value }] for MongoDB storage.
 *
 * The frontend (handleSave in EditFileDataDialog) sends metadata as a plain object
 * where every value is already a JSON string produced by JSON.stringify():
 *   { reporterName: '"Desmond"', challenges: '[]', rank: '"Software "' }
 *
 * We store it as [{ key, value }] so individual keys can be indexed/queried.
 *
 * Also accepts the array shape [{ key, value }] for flexibility.
 */
function normalizeMetadata(raw) {
  if (!raw) return [];

  // Plain object shape sent by the frontend: { fieldName: jsonString, ... }
  if (!Array.isArray(raw) && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({
      key,
      value: value != null ? String(value) : '',
    }));
  }

  // Array shape: [{ key, value }, ...]
  if (Array.isArray(raw)) {
    return raw
      .filter((m) => m && typeof m.key === 'string')
      .map((m) => ({ key: m.key, value: m.value != null ? String(m.value) : '' }));
  }

  return [];
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

function toListDto(file) {
  return {
    id: file._id,
    name: file.name,
    folderId: file.folderId,
    sizeBytes: file.sizeBytes,
    metadata: metadataToObject(file.metadata), // plain object for the frontend
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

function toFullDto(file, content) {
  return {
    ...toListDto(file),
    content: content || '',
  };
}

// ─── Ownership guards ─────────────────────────────────────────────────────────

async function assertFolderOwnership(folderId, userId) {
  const folder = await Folder.findById(folderId);
  if (!folder) throw new NotFoundError('Folder not found');
  const project = await Project.findById(folder.projectId);
  if (!project || project.ownerId.toString() !== userId) throw new UnauthorizedError();
  return folder;
}

async function getFileWithOwnership(fileId, userId) {
  const file = await AppFile.findById(fileId);
  if (!file) throw new NotFoundError('File not found');
  await assertFolderOwnership(file.folderId, userId);
  return file;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function getByFolder(req, res, next) {
  try {
    await assertFolderOwnership(req.params.folderId, req.userId);
    const files = await AppFile.find({ folderId: req.params.folderId }).sort({ createdAt: -1 });
    res.json(files.map(toListDto));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const file = await getFileWithOwnership(req.params.id, req.userId);
    const content = await fileStorage.downloadContent(file.storageKey);
    const response = { file, content }
    res.json(response);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    await assertFolderOwnership(req.params.folderId, req.userId);

    const { name, content = '', metadata } = req.body;

    const storageKey = await fileStorage.uploadContent(content);
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    const file = await AppFile.create({
      name,
      folderId: req.params.folderId,
      storageKey,
      sizeBytes,
      metadata: normalizeMetadata(metadata),
    });

    res.status(201).json(toFullDto(file, content));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const file = await getFileWithOwnership(req.params.id, req.userId);

    const { name, content, metadata } = req.body;

    console.log("req.body")

    if (name !== undefined) file.name = name;

    if (content !== undefined) {
      await fileStorage.updateContent(file.storageKey, content);
      file.sizeBytes = Buffer.byteLength(content, 'utf8');
    }

    if (metadata !== undefined) {
      file.metadata = normalizeMetadata(metadata);
    }

    await file.save();

    const savedContent =
      content !== undefined ? content : await fileStorage.downloadContent(file.storageKey);

    const response = { file, savedContent }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const file = await getFileWithOwnership(req.params.id, req.userId);
    await fileStorage.deleteContent(file.storageKey);
    await AppFile.deleteOne({ _id: file._id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getByFolder,
  getById,
  create,
  update,
  remove,
  createFileRules,
  updateFileRules,
  folderIdParam,
  idParam,
};