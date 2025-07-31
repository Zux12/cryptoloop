const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: '7fefcc81128e8a8bdaf0e28bae0c0b38102624d4',
        public: true
      }
    });

    const results = response?.data?.results;

    if (!Array.isArray(results)) {
      console.warn("⚠️ CryptoPanic API returned invalid data:", response.data);
      return res.status(502).json({ error: "Invalid response from CryptoPanic" });
    }

    res.json(results.slice(0, 5));
  } catch (err) {
    console.error("❌ Error fetching news:", err.message);
    res.status(500).json({ error: 'Failed to fetch crypto news' });
  }
});

module.exports = router;
