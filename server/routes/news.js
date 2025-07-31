const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { data } = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: 'demo', // Replace with your real key if needed
        public: true
      }
    });

    res.json(data.results.slice(0, 5)); // Return only 5 items
  } catch (err) {
    console.error("❌ Error fetching news:", err.message);
    res.status(500).json({ error: 'Failed to fetch crypto news' });
  }
});

module.exports = router;
