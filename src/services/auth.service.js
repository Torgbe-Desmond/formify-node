const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ─── JWT Service ─────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-32-chars-minimum-secret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'FastTransfers';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'FastTransfers';
const JWT_EXPIRY_MINUTES = parseInt(process.env.JWT_EXPIRY_MINUTES || '60', 10);

/**
 * Generate a signed JWT for the given user document.
 */
function generateToken(user) {
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
    jti: uuidv4(),
  };
  return jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRY_MINUTES * 60,
  });
}

/**
 * Verify a JWT and return the decoded payload. Throws on invalid/expired token.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

// ─── Password Service ────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { generateToken, verifyToken, hashPassword, verifyPassword };
