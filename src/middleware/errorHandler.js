const logger = require('../config/logger');

/**
 * Domain error classes — thrown throughout the controllers/services.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = {}) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * Express global error handler — maps error classes to HTTP status codes.
 * Must be registered last with app.use().
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // express-validator result (passed as thrown object)
  if (err.statusCode === 422 && err.errors) {
    return res.status(422).json({ message: err.message, errors: err.errors });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate key conflict' });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = {};
    Object.keys(err.errors).forEach((k) => {
      errors[k] = err.errors[k].message;
    });
    return res.status(422).json({ message: 'Validation failed', errors });
  }

  // Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(404).json({ message: 'Resource not found' });
  }

  logger.error({ message: err.message, stack: err.stack, path: req.path });
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = {
  errorHandler,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ValidationError,
  AppError,
};
