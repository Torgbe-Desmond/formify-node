const { body, param } = require('express-validator');
const { Folder, Project, AppFile } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const fileStorage = require('../services/fileStorage.service');

// ─── Validators ──────────────────────────────────────────────────────────────
const createFileRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 500 }),
  body('content').optional().isString(),
  body('metadata').optional().isArray(),
  validate,
];

const updateFileRules = [
  body('name').optional().trim().isLength({ max: 500 }),
  body('content').optional().isString(),
  body('metadata').optional().isArray(),
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toListDto(file) {
  return {
    id: file._id,
    name: file.name,
    folderId: file.folderId,
    sizeBytes: file.sizeBytes,
    metadata: file.metadata,
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
    res.json(toFullDto(file, content));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    await assertFolderOwnership(req.params.folderId, req.userId);

    const { name, content = '', metadata = [] } = req.body;

    // Upload content to MongoDB file collection, get back storage key
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

    if (name !== undefined) file.name = name;

    if (content !== undefined) {
      await fileStorage.updateContent(file.storageKey, content);
      file.sizeBytes = Buffer.byteLength(content, 'utf8');
    }

    if (metadata !== undefined) {
      file.metadata = normalizeMetadata(metadata);
    }

    await file.save();

    // Return updated content
    const savedContent =
      content !== undefined ? content : await fileStorage.downloadContent(file.storageKey);

    res.json(toFullDto(file, savedContent));
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

// Ensure metadata is an array of { key, value } objects
function normalizeMetadata(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.key === 'string')
    .map((m) => ({ key: m.key, value: m.value != null ? String(m.value) : '' }));
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
