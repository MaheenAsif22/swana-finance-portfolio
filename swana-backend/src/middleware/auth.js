'use strict';

const jwt = require('jsonwebtoken');

const secret  = () => process.env.JWT_SECRET || 'swana-dev-secret';
const expires = () => process.env.JWT_EXPIRES_IN || '30d';

function signToken(payload) {
  return jwt.sign(payload, secret(), { expiresIn: expires() });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), secret());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

module.exports = { signToken, authenticate, requireOwner };
