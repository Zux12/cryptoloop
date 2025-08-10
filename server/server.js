// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5050;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// Static (choose ONE location for your built/static files)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Routes (mount once, with safe guards) ----------
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
} catch (err) {
  console.error('🔥 Crash in /api/auth:', err.message);
}

try {
  const userRoutes = require('./routes/user');
  app.use('/api/user', userRoutes);
} catch (err) {
  console.error('🔥 Crash in /api/user:', err.message);
}

try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
} catch (err) {
  console.error('🔥 Crash in /api/admin:', err.message);
}

try {
  const aiRoutes = require('./routes/cryptoAi');
  app.use('/api/ai', aiRoutes);
} catch (err) {
  console.error('🔥 Crash in /api/ai:', err.message);
}

// Price proxy
app.get('/api/price/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch price', error: err.message });
  }
});

// Crypto news
console.log('📍 Registering /api/news route');
try {
  app.use('/api/news', require('./routes/news'));
} catch (err) {
  console.error('🔥 Crash in /api/news:', err.message);
}

// ---------- API 404 guard ----------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ msg: 'API route not found' });
  }
  next();
});

// ---------- SPA fallback ----------
app.use((req, res) => {
  const fallbackPath = path.join(__dirname, '..', 'public', 'index.html');
  fs.exists(fallbackPath, (exists) => {
    if (exists) {
      res.sendFile(fallbackPath);
    } else {
      res.status(404).send('Not Found');
    }
  });
});

// ---------- Start Server after Mongo connects ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });
