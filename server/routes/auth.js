  const express = require('express');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const User = require('../models/User');
  const authMiddleware = require('../middleware/authMiddleware');

  const router = express.Router();

  // 🔹 Test Route
  router.get('/test', (req, res) => {
    res.send('✅ Auth route is working!');
  });

  // 🔐 Signup Route
  router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ msg: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ name, email, password: hashedPassword });
      await newUser.save();

      res.status(201).json({ msg: 'Signup successful' });
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  // 🔐 Login Route
  router.post('/login', async (req, res) => {
    console.log('📥 LOGIN BODY:', req.body);  // ✅ ADD THIS
    const { email, password } = req.body;

    // ✅ Hardcoded admin
    if (email === 'admin@gmail.com' && password === 'admin123') {
      console.log('✅ ADMIN LOGIN MATCHED');  // ✅ Add this too
  // ✅ FIX: Include 'id' field for admin token
  const token = jwt.sign(
    { email: 'admin@gmail.com', isAdmin: true, id: 'admin' },
    process.env.JWT_SECRET || 'secret'
  );

      
      return res.json({ token, redirect: '/admin.html' }); // ✅ ADD "return" here
    }
    
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ msg: 'User not found' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ msg: 'Incorrect password' });

      const token = jwt.sign({
        email: user.email,
        id: user._id,
        isAdmin: false
      }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      return res.json({ token, redirect: '/dashboard.html' });
    } catch (err) {
      return res.status(500).json({ msg: 'Login failed', error: err.message });
    }
  });


  // 🔍 Get current logged-in user info
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('name email');
      res.json(user);
    } catch (err) {
      res.status(500).json({ msg: 'Failed to load user info' });
    }
  });

//for testing only on cryptoloop render
  router.get('/all-users', async (req, res) => {
    const users = await User.find({});
    res.json(users);
  });
  
  module.exports = router;
