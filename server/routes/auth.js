// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Optional health check to debug mounting quickly
router.get('/ping', (req, res) => res.json({ ok: true, scope: 'auth' }));

// Prefer real client IP (Render/Cloudflare/NGINX/CDN safe)
function getClientIp(req) {
  const chain =
    req.headers['cf-connecting-ip'] ||               // Cloudflare
    req.headers['x-real-ip'] ||                      // NGINX/Proxies
    req.headers['x-forwarded-for'] ||                // Comma-separated list
    req.ip ||
    '';

  // If it's a list, take the first
  const first = String(chain).split(',')[0].trim();

  // Ignore private/loopback ranges
  const isPrivate =
    /^10\./.test(first) ||
    /^192\.168\./.test(first) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(first) ||
    /^127\./.test(first) ||
    first === '::1';

  return isPrivate ? '' : first;
}



// ---- helper: IP -> geo (best-effort, no key) ----
async function geoFromIp(ip) {
  try {
    if (!ip) return { city: '', country: '' };

    // Primary: ipapi
    let city = '', country = '';
    try {
      const r1 = await fetch(`https://ipapi.co/${ip}/json/`);
      if (r1.ok) {
        const j1 = await r1.json();
        city = j1.city || '';
        country = j1.country_name || j1.country || '';
      }
    } catch {}

    // Secondary: ipinfo (no token = very limited but ok as a fallback)
    if (!city || !country) {
      try {
        const r2 = await fetch(`https://ipinfo.io/${ip}/json`);
        if (r2.ok) {
          const j2 = await r2.json();
          city = city || j2.city || '';
          country = country || j2.country || '';
        }
      } catch {}
    }

    return { city, country };
  } catch {
    return { city: '', country: '' };
  }
}


// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    let { name, email, password, agent } = req.body;
    if (!name || !email || !password || !agent) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    email = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ msg: 'Email already in use' });

    const hash = await bcrypt.hash(password, 12);

    await User.create({
      name: String(name).trim(),
      email,
      password: hash,
      agent,            // must match your enum (AG10xx)
      isApproved: false // pending by default
    });

    res.json({ msg: 'Account created. Awaiting admin approval.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = String(email).toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ msg: 'Invalid credentials' });

    if (!user.isApproved) {
      return res.status(403).json({ msg: '⛔ Your account is pending admin approval.' });
    }

    // record last login + best-effort geo
    const xfwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = getClientIp(req);
user.lastLoginAt = new Date();
user.lastLoginIp = ip || '';

    try {
      const { city, country } = await geoFromIp(user.lastLoginIp);
      user.lastLoginCity = city || '';
      user.lastLoginCountry = country || '';
    } catch {
      user.lastLoginCity = '';
      user.lastLoginCountry = '';
    }

    await user.save(); // single save

    const token = jwt.sign(
      { uid: user._id, isAdmin: !!user.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const redirect = user.isAdmin ? '/admin.html' : '/dashboard.html';

    res.json({ token, isAdmin: !!user.isAdmin, redirect });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
