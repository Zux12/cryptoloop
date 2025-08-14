const jwt = require('jsonwebtoken');

// ✅ Require authentication (valid JWT)
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  console.log("🔐 Checking auth header:", authHeader);

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("📦 Decoded token payload:", decoded);

    // Expecting token to have: { uid, isAdmin, ... }
    req.user = {
      uid: decoded.uid,
      isAdmin: !!decoded.isAdmin
    };

    console.log("📥 Authenticated user:", req.user);
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    return res.status(403).json({ msg: 'Invalid or expired token' });
  }
};

// ✅ Require admin privileges
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ msg: 'Access denied. Admins only.' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };



