const { verifyToken } = require('../services/auth.service');

/**
 * Express middleware — validates Bearer JWT and attaches userId to req.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userName = payload.name;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
}

module.exports = { authenticate };
