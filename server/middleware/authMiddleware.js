// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Attach req.user = { uid, isAdmin } or 401
function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    if (!hdr.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'Access denied. No token provided.' });
    }
    const token = hdr.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded should contain { uid, isAdmin }
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ msg: 'Invalid token' });
    }
    req.user = { uid: String(decoded.uid), isAdmin: !!decoded.isAdmin };
    next();
  } catch (err) {
    return res.status(403).json({ msg: 'Invalid or expired token' });
  }
}

// Require admin flag or 403
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ msg: 'Admin only' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
