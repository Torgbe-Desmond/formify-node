const { body, param } = require('express-validator');
const { Folder, Project, SchemaTemplate } = require('../models');
const { NotFoundError, UnauthorizedError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');

// ─── Validators ──────────────────────────────────────────────────────────────

const schemaRules = [
  // New multi-schema shape
  body('schemas').optional().isObject().withMessage('schemas must be an object'),
  body('entrySchema').optional().isString(),
  // Legacy flat fields — still accepted for backwards compat
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

/**
 * Normalise a SchemaTemplate document into the multi-schema DTO shape.
 * Handles both new documents (schemas Map) and legacy flat documents.
 */
function toDto(doc) {
  let schemas;
  let entrySchema;

  // New shape — schemas is a Mongoose Map
  if (doc.schemas && doc.schemas.size > 0) {
    schemas = Object.fromEntries(doc.schemas);
    entrySchema = doc.entrySchema || 'Main';
  } else {
    // Legacy flat shape — wrap into Main
    schemas = {
      Main: {
        schemaYaml:   doc.schemaYaml   || '',
        templateHtml: doc.templateHtml || '',
        templateCss:  doc.templateCss  || '',
      },
    };
    entrySchema = 'Main';
  }

  return {
    id:          doc._id,
    folderId:    doc.folderId,
    entrySchema,
    schemas,
    createdAt:   doc.createdAt,
    updatedAt:   doc.updatedAt,
  };
}

/**
 * Normalise an incoming request body into the shape we store.
 * Accepts:
 *   - New shape:  { schemas: { [name]: { schemaYaml, templateHtml, templateCss } }, entrySchema }
 *   - Legacy shape: { schemaYaml, templateHtml, templateCss }
 */
function normaliseBody(body) {
  if (body.schemas && typeof body.schemas === 'object') {
    // New shape — convert plain object to Map entries
    return {
      entrySchema: body.entrySchema || 'Main',
      schemas:     new Map(Object.entries(body.schemas)),
      // Clear legacy fields
      schemaYaml:   undefined,
      templateHtml: undefined,
      templateCss:  undefined,
    };
  }

  // Legacy flat shape — wrap into Main entry
  return {
    entrySchema: 'Main',
    schemas: new Map([
      ['Main', {
        schemaYaml:   body.schemaYaml   || '',
        templateHtml: body.templateHtml || '',
        templateCss:  body.templateCss  || '',
      }],
    ]),
    schemaYaml:   undefined,
    templateHtml: undefined,
    templateCss:  undefined,
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

    const update = normaliseBody(req.body);

    const schema = await SchemaTemplate.findOneAndUpdate(
      { folderId: req.params.folderId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(toDto(schema));
  } catch (err) {
    next(err);
  }
}

module.exports = { get, upsert, schemaRules, folderIdParam };
