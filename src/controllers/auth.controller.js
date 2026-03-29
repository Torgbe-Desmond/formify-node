const { body } = require('express-validator');
const { User } = require('../models');
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require('../services/auth.service');
const { ConflictError, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');

// ─── Validators ──────────────────────────────────────────────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  validate,
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// ─── Handlers ────────────────────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw new ConflictError('Email already in use');

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash });

    const token = generateToken(user);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ValidationError('Invalid email or password');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new ValidationError('Invalid email or password');

    const token = generateToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, registerRules, loginRules };
