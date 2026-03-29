const { body, param } = require('express-validator');
const { Folder, Project, SchemaTemplate } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');

// ─── Validators ──────────────────────────────────────────────────────────────
const schemaRules = [
  body('schemaYaml').optional().isString(),
  body('templateHtml').optional().isString(),
  body('templateCss').optional().isString(),
  validate,
];

const folderIdParam = [
  param('folderId').isMongoId().withMessage('Invalid folderId'),
  validate,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDto(schema) {
  return {
    id: schema._id,
    folderId: schema.folderId,
    schemaYaml: schema.schemaYaml,
    templateHtml: schema.templateHtml,
    templateCss: schema.templateCss,
    createdAt: schema.createdAt,
    updatedAt: schema.updatedAt,
  };
}

async function assertFolderOwnership(folderId, userId) {
  const folder = await Folder.findById(folderId);
  if (!folder) throw new NotFoundError('Folder not found');
  const project = await Project.findById(folder.projectId);
  if (!project || project.ownerId.toString() !== userId) throw new UnauthorizedError();
  return folder;
}

// ─── Handlers ────────────────────────────────────────────────────────────────
async function get(req, res, next) {
  try {
    await assertFolderOwnership(req.params.folderId, req.userId);
    const schema = await SchemaTemplate.findOne({ folderId: req.params.folderId });
    if (!schema) throw new NotFoundError('Schema not found');
    res.json(toDto(schema));
  } catch (err) {
    next(err);
  }
}

async function upsert(req, res, next) {
  try {
    await assertFolderOwnership(req.params.folderId, req.userId);

    const { schemaYaml = '', templateHtml = '', templateCss = '' } = req.body;

    const schema = await SchemaTemplate.findOneAndUpdate(
      { folderId: req.params.folderId },
      { $set: { schemaYaml, templateHtml, templateCss } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(toDto(schema));
  } catch (err) {
    next(err);
  }
}

module.exports = { get, upsert, schemaRules, folderIdParam };
