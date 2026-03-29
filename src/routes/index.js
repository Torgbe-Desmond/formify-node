const express = require('express');
const { authenticate } = require('../middleware/auth');

// Controllers
const auth = require('../controllers/auth.controller');
const projects = require('../controllers/projects.controller');
const folders = require('../controllers/folders.controller');
const schema = require('../controllers/schema.controller');
const files = require('../controllers/files.controller');
const { breadcrumb, breadcrumbRules } = require('../controllers/breadcrumb.controller');

const router = express.Router();

// ─── Health check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Auth (public) ───────────────────────────────────────────────────────────
router.post('/auth/register', auth.registerRules, auth.register);
router.post('/auth/login', auth.loginRules, auth.login);

// ─── Protected routes ────────────────────────────────────────────────────────
router.use(authenticate);

// Breadcrumb
router.get('/breadcrumb/:type/:id', breadcrumbRules, breadcrumb);

// Projects
router.get('/projects', projects.getAll);
router.get('/projects/:id', projects.idParam, projects.getById);
router.post('/projects', projects.projectRules, projects.create);
router.put('/projects/:id', [...projects.idParam, ...projects.projectRules], projects.rename);
router.delete('/projects/:id', projects.idParam, projects.remove);

// Folders
router.get('/projects/:projectId/folders', folders.projectIdParam, folders.getByProject);
router.post('/projects/:projectId/folders', [...folders.projectIdParam, ...folders.folderRules], folders.create);
router.put('/folders/:id', [...folders.idParam, ...folders.folderRules], folders.rename);
router.delete('/folders/:id', folders.idParam, folders.remove);

// Schema
router.get('/folders/:folderId/schema', schema.folderIdParam, schema.get);
router.put('/folders/:folderId/schema', [...schema.folderIdParam, ...schema.schemaRules], schema.upsert);

// Files
router.get('/folders/:folderId/files', files.folderIdParam, files.getByFolder);
router.post('/folders/:folderId/files', [...files.folderIdParam, ...files.createFileRules], files.create);
router.get('/files/:id', files.idParam, files.getById);
router.put('/files/:id', [...files.idParam, ...files.updateFileRules], files.update);
router.delete('/files/:id', files.idParam, files.remove);

module.exports = router;
