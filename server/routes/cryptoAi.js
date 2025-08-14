// routes/cryptoAi.js
const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
// ⚠️ Use the exact filename case that exists on disk: models/cryptoAISim.js
const CryptoAISim = require('../models/cryptoAISim');

const router = express.Router();

// All /api/ai routes require auth
router.use(requireAuth);

/**
 * GET /api/ai/load
 * Returns the last saved state for this user.
 * { simulatedValue: number|null, lastUpdated: string|null }
 */
router.get('/load', async (req, res) => {
  try {
    const doc = await CryptoAISim.findOne({ userId: req.user.uid });
    if (!doc) return res.json({ simulatedValue: null, lastUpdated: null });
    res.json({
      simulatedValue: doc.simulatedValue,
      lastUpdated: doc.lastUpdated
    });
  } catch (err) {
    console.error('GET /ai/load error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * POST /api/ai/save
 * Body: { simulatedValue: number }
 * Upserts per-user state
 */
router.post('/save', async (req, res) => {
  try {
    const { simulatedValue } = req.body || {};
    if (typeof simulatedValue !== 'number' || !isFinite(simulatedValue)) {
      return res.status(400).json({ msg: 'Invalid simulatedValue' });
    }

    const now = new Date();
    const doc = await CryptoAISim.findOneAndUpdate(
      { userId: req.user.uid },
      { $set: { simulatedValue, lastUpdated: now } },
      { upsert: true, new: true }
    );

    res.json({
      ok: true,
      simulatedValue: doc.simulatedValue,
      lastUpdated: doc.lastUpdated
    });
  } catch (err) {
    console.error('POST /ai/save error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router; // 👈 IMPORTANT: export the router function
