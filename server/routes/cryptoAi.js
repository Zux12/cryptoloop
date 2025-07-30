const express = require('express');
const router = express.Router();
const CryptoAISim = require('../models/CryptoAISim');
const auth = require('../middleware/authMiddleware');


// @desc    Load saved AI simulation state
// @route   GET /api/ai/load
// @access  Private
router.get('/load', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await CryptoAISim.findOne({ userId });
    if (!data) return res.json(null);
    res.json(data);
  } catch (err) {
    console.error('Error loading AI sim:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @desc    Save AI simulation state
// @route   POST /api/ai/save
// @access  Private
router.post('/save', auth, async (req, res) => {
  try {
    const { simulatedValue, lastUpdated } = req.body;
    const userId = req.user.id;

    const result = await CryptoAISim.findOneAndUpdate(
      { userId },
      { simulatedValue, lastUpdated },
      { upsert: true, new: true }
    );

    res.json({ success: true, result });
  } catch (err) {
    console.error('Error saving AI sim:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
