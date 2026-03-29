const { validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Runs after express-validator chains. Throws ValidationError if any field failed.
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = {};
    result.array().forEach(({ path, msg }) => {
      errors[path] = msg;
    });
    return next(new ValidationError('Validation failed', errors));
  }
  next();
}

module.exports = { validate };
