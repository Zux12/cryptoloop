const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("🔐 Checking auth header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("📦 Decoded token payload:", decoded);

    // ✅ Preserve full decoded payload including isAdmin
    req.user = decoded;

    console.log("📥 Decoded user:", req.user);
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    return res.status(403).json({ msg: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
