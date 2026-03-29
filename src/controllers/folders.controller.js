const { body, param } = require('express-validator');
const { Project, Folder, SchemaTemplate, AppFile } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const fileStorage = require('../services/fileStorage.service');

// ─── Validators ──────────────────────────────────────────────────────────────
const folderRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  validate,
];

const projectIdParam = [
  param('projectId').isMongoId().withMessage('Invalid projectId'),
  validate,
];

const idParam = [
  param('id').isMongoId().withMessage('Invalid folder id'),
  validate,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDto(folder) {
  return {
    id: folder._id,
    name: folder.name,
    projectId: folder.projectId,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

async function assertProjectOwnership(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError('Project not found');
  if (project.ownerId.toString() !== userId) throw new UnauthorizedError();
  return project;
}

async function getFolderWithOwnership(folderId, userId) {
  const folder = await Folder.findById(folderId);
  if (!folder) throw new NotFoundError('Folder not found');
  await assertProjectOwnership(folder.projectId, userId);
  return folder;
}

// ─── Handlers ────────────────────────────────────────────────────────────────
async function getByProject(req, res, next) {
  try {
    await assertProjectOwnership(req.params.projectId, req.userId);
    const folders = await Folder.find({ projectId: req.params.projectId }).sort({ createdAt: 1 });
    res.json(folders.map(toDto));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    await assertProjectOwnership(req.params.projectId, req.userId);
    const folder = await Folder.create({
      name: req.body.name,
      projectId: req.params.projectId,
    });
    res.status(201).json(toDto(folder));
  } catch (err) {
    next(err);
  }
}

async function rename(req, res, next) {
  try {
    const folder = await getFolderWithOwnership(req.params.id, req.userId);
    folder.name = req.body.name;
    await folder.save();
    res.json(toDto(folder));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const folder = await getFolderWithOwnership(req.params.id, req.userId);

    // Cascade: delete file content, files, schema, folder
    const files = await AppFile.find({ folderId: folder._id });
    for (const file of files) {
      try {
        await fileStorage.deleteContent(file.storageKey);
      } catch {
        /* ignore */
      }
    }

    await AppFile.deleteMany({ folderId: folder._id });
    await SchemaTemplate.deleteOne({ folderId: folder._id });
    await Folder.deleteOne({ _id: folder._id });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getByProject,
  create,
  rename,
  remove,
  folderRules,
  projectIdParam,
  idParam,
};
