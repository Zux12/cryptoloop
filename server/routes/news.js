const express = require('express');
const axios = require('axios');
const router = express.Router();

const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

router.get('/', async (req, res) => {
  try {
    const { data } = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: 'crypto OR bitcoin OR ethereum',
        lang: 'en',
        max: 5,
        token: GNEWS_API_KEY
      }
    });

    if (!data.articles || !Array.isArray(data.articles)) {
      return res.status(502).json({ error: 'Invalid response from GNews' });
    }

    res.json(data.articles);
  } catch (err) {
    console.error("❌ GNews error:", err.message);
    res.status(500).json({ error: 'Failed to fetch GNews' });
  }
});

module.exports = router;
