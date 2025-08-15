// routes/cryptoAi.js
const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const CryptoAISim = require('../models/cryptoAISim'); // make sure filename matches exactly

const router = express.Router();

// All /api/ai routes require auth
router.use(requireAuth);

/**
 * GET /api/ai/load
 * Returns the last saved state for this user.
 * { simulatedValue, lastUpdated, baseValue }
 */
router.get('/load', async (req, res) => {
  try {
    const doc = await CryptoAISim.findOne({ userId: req.user.uid });
    if (!doc) {
      return res.json({
        simulatedValue: null,
        lastUpdated: null,
        baseValue: null
      });
    }
    res.json({
      simulatedValue: doc.simulatedValue,
      lastUpdated: doc.lastUpdated,
      baseValue: doc.baseValue ?? null
    });
  } catch (err) {
    console.error('GET /ai/load error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * POST /api/ai/save
 * Body: { simulatedValue: number, baseValue?: number }
 * Upserts per-user state
 */
router.post('/save', async (req, res) => {
  try {
    const { simulatedValue, baseValue } = req.body || {};
    if (typeof simulatedValue !== 'number' || !isFinite(simulatedValue)) {
      return res.status(400).json({ msg: 'Invalid simulatedValue' });
    }

    const update = {
      simulatedValue,
      lastUpdated: new Date()
    };

    // Only set baseValue if it’s provided
    if (typeof baseValue === 'number' && isFinite(baseValue)) {
      update.baseValue = baseValue;
    }

    const doc = await CryptoAISim.findOneAndUpdate(
      { userId: req.user.uid },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      ok: true,
      simulatedValue: doc.simulatedValue,
      lastUpdated: doc.lastUpdated,
      baseValue: doc.baseValue ?? null
    });
  } catch (err) {
    console.error('POST /ai/save error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
