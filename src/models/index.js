const mongoose = require('mongoose');

// ─── Shared options ──────────────────────────────────────────────────────────
const baseOptions = {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
};

// ─── User ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  baseOptions
);

// ─── Project ─────────────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  baseOptions
);

// ─── Folder ──────────────────────────────────────────────────────────────────
const folderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
  },
  baseOptions
);

// ─── SchemaTemplate ──────────────────────────────────────────────────────────
//
// New multi-schema shape:
//   entrySchema  — name of the root schema used to render files in this folder
//   schemas      — map of named schema definitions:
//                  { [SchemaName]: { schemaYaml, templateHtml, templateCss } }
//
// Migration: old documents with flat schemaYaml/templateHtml/templateCss fields
// are accepted on read and normalised by the controller into the new shape.
//
const namedSchemaSchema = new mongoose.Schema(
  {
    schemaYaml:   { type: String, default: '' },
    templateHtml: { type: String, default: '' },
    templateCss:  { type: String, default: '' },
  },
  { _id: false }
);

const schemaTemplateSchema = new mongoose.Schema(
  {
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
      unique: true,
      index: true,
    },
    // New shape
    entrySchema: { type: String, default: 'Main' },
    schemas: {
      type: Map,
      of: namedSchemaSchema,
      default: () => new Map([[ 'Main', { schemaYaml: '', templateHtml: '', templateCss: '' } ]]),
    },
    // Legacy flat fields — kept so old documents are not broken on read.
    // The controller normalises these into the schemas map when encountered.
    schemaYaml:   { type: String },
    templateHtml: { type: String },
    templateCss:  { type: String },
  },
  baseOptions
);

// ─── AppFile ─────────────────────────────────────────────────────────────────
const appFileMetadataSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, default: '' }, // JSON string
  },
  { _id: false }
);

const appFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 500 },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
      index: true,
    },
    storageKey: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    metadata: { type: [appFileMetadataSchema], default: [] },
  },
  baseOptions
);

// ensure unique (fileId, key) — equivalent to the SQL unique index
appFileSchema.index({ _id: 1, 'metadata.key': 1 }, { unique: false });

module.exports = {
  User: mongoose.model('User', userSchema),
  Project: mongoose.model('Project', projectSchema),
  Folder: mongoose.model('Folder', folderSchema),
  SchemaTemplate: mongoose.model('SchemaTemplate', schemaTemplateSchema),
  AppFile: mongoose.model('AppFile', appFileSchema),
};
