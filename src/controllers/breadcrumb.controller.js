const { param } = require('express-validator');
const { getBreadcrumb } = require('../services/breadcrumb.service');
const { validate } = require('../middleware/validate');

/**
 * GET /api/breadcrumb/:type/:id
 *
 * :type — one of  project | folder | file
 * :id   — MongoDB ObjectId string
 *
 * Response example (starting from a file):
 * [
 *   { id, name, type: 'project', level: 0, parentId: null },
 *   { id, name, type: 'folder',  level: 1, parentId: '<projectId>' },
 *   { id, name, type: 'file',    level: 2, parentId: '<folderId>'  },
 * ]
 */
const breadcrumbRules = [
  param('type')
    .isIn(['project', 'folder', 'file'])
    .withMessage('type must be one of: project, folder, file'),
  param('id').isMongoId().withMessage('Invalid id'),
  validate,
];

async function breadcrumb(req, res, next) {
  try {
    const { type, id } = req.params;
    const crumbs = await getBreadcrumb(type, id);
    res.json(crumbs);
  } catch (err) {
    next(err);
  }
}

module.exports = { breadcrumb, breadcrumbRules };