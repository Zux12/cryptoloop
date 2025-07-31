const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  console.log("🟢 /api/news route triggered");
  
  try {
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: process.env.CRYPTOPANIC_KEY,
        public: true
      }
    });

    const results = response?.data?.results;

    if (!Array.isArray(results)) {
      console.warn("⚠️ CryptoPanic API returned invalid data:", response.data);
      return res.status(502).json({ error: "Invalid response from CryptoPanic" });
    }
    
    console.log("✅ Fetched news:", results.slice(0, 5).map(a => a.title));
    res.json(results.slice(0, 5));
  } catch (err) {
    console.error("❌ Error fetching news:", err.message);
    res.status(500).json({ error: 'Failed to fetch crypto news' });
  }
});

module.exports = router;
