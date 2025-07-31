const express = require('express');
const axios = require('axios');
const router = express.Router();

const CRYPTOPANIC_API_KEY = process.env.CRYPTOPANIC_KEY;
let cachedNews = null;
let lastFetched = 0;

router.get('/', async (req, res) => {
  const now = Date.now();

  // ✅ If cache is fresh (under 24h), return it
  if (cachedNews && now - lastFetched < 86400000) {
    console.log("🌀 Serving cached news");
    return res.json(cachedNews);
  }

  try {
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: CRYPTOPANIC_API_KEY,
        public: true
      }
    });

    const results = response?.data?.results?.slice(0, 5);
    if (!results || !Array.isArray(results)) {
      return res.status(502).json({ error: 'Invalid data from CryptoPanic' });
    }

    cachedNews = results;
    lastFetched = now;

    console.log("✅ Fetched new news from CryptoPanic");
    res.json(cachedNews);
  } catch (err) {
    console.error("❌ Failed to fetch news:", err.message);
    res.status(500).json({ error: 'Failed to fetch crypto news' });
  }
});

module.exports = router;
