// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

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
      name: name.trim(),
      email,
      password: hash,
      agent,                 // must be AG1001…AG1020 per your model enum
      isApproved: false
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

    // record last login (Render-friendly)
    const xfwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    user.lastLoginAt = new Date();
    user.lastLoginIp = xfwd || req.ip || '';
    await user.save();

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
