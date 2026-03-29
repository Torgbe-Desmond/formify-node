const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const { Project, Folder, SchemaTemplate, AppFile } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const fileStorage = require('../services/fileStorage.service');

// ─── Validators ──────────────────────────────────────────────────────────────
const projectRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  validate,
];

const idParam = [
  param('id').isMongoId().withMessage('Invalid project id'),
  validate,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDto(project) {
  return {
    id: project._id,
    name: project.name,
    ownerId: project.ownerId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function getOwned(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError('Project not found');
  if (project.ownerId.toString() !== userId) throw new UnauthorizedError();
  return project;
}

// ─── Handlers ────────────────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const projects = await Project.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    res.json(projects.map(toDto));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const project = await getOwned(req.params.id, req.userId);
    res.json(toDto(project));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const project = await Project.create({ name: req.body.name, ownerId: req.userId });
    res.status(201).json(toDto(project));
  } catch (err) {
    next(err);
  }
}

async function rename(req, res, next) {
  try {
    const project = await getOwned(req.params.id, req.userId);
    project.name = req.body.name;
    await project.save();
    res.json(toDto(project));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const project = await getOwned(req.params.id, req.userId);

    // Cascade: delete all files content, then files, schemas, folders, project
    const folders = await Folder.find({ projectId: project._id });
    const folderIds = folders.map((f) => f._id);

    const files = await AppFile.find({ folderId: { $in: folderIds } });
    for (const file of files) {
      try {
        await fileStorage.deleteContent(file.storageKey);
      } catch {
        /* ignore missing storage entries */
      }
    }

    await AppFile.deleteMany({ folderId: { $in: folderIds } });
    await SchemaTemplate.deleteMany({ folderId: { $in: folderIds } });
    await Folder.deleteMany({ projectId: project._id });
    await Project.deleteOne({ _id: project._id });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, rename, remove, projectRules, idParam };
