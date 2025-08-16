// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5050;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// Static assets (serve your frontend from /public)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Helper to mount routers safely ----------
function mountRoute(routePath, modulePath) {
  try {
    const router = require(modulePath);
    // Express routers are functions (req, res, next)
    if (typeof router !== 'function') {
      console.error(`🔥 Crash in ${routePath}: argument handler must be a function (exported type: ${typeof router})`);
      return;
    }
    app.use(routePath, router);
    console.log(`✅ Mounted ${routePath} from ${modulePath}`);
  } catch (err) {
    console.error(`🔥 Crash in ${routePath}:`, err.message);
    console.error(err.stack); // <-- shows the exact file & line
  }
}

// ---------- Routes ----------
mountRoute('/api/auth', './routes/auth');
mountRoute('/api/user', './routes/user');
mountRoute('/api/admin', './routes/admin');
mountRoute('/api/ai', './routes/cryptoAi');

// Price proxy (CoinGecko)
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
mountRoute('/api/news', './routes/news');

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

// ---------- Connect DB then start server ----------
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
