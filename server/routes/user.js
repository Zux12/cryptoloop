// routes/user.js
const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest');
const User = require('../models/User');

const router = express.Router();

// all user routes require auth
router.use(requireAuth);

// attach current user doc once
router.use(async (req, res, next) => {
  try {
    const u = await User.findById(req.user.uid).select('name email wallet');
    if (!u) return res.status(404).json({ msg: 'User not found' });
    req.currentUser = u;
    next();
  } catch (e) {
    next(e);
  }
});

// POST /api/user/buy
router.post('/buy', async (req, res) => {
  const { symbol, usd } = req.body;
  if (!symbol || !usd) {
    return res.status(400).json({ msg: 'Missing symbol or USD amount' });
  }

  try {
    const coingeckoId = ({
      btc: 'bitcoin',
      eth: 'ethereum',
      usdt: 'tether',
      bnb: 'binancecoin'
    }[symbol.toLowerCase()]) || symbol;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );

    let price = 1;
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      price = data[coingeckoId]?.usd ?? 1;
    }

    const amount = usd / price;

    const request = new BuyRequest({
      user: req.currentUser.email,
      symbol,
      usd,
      amount,
      status: 'Pending',
      timestamp: new Date()
    });

    await request.save();
    res.status(201).json({
      msg: 'Buy request submitted successfully',
      request: {
        symbol: request.symbol,
        usd: request.usd,
        amount: request.amount,
        status: request.status,
        timestamp: request.timestamp
      }
    });
  } catch (err) {
    console.error('❌ Failed in /buy:', err.message);
    res.status(500).json({ msg: 'Failed to save request', error: err.message });
  }
});

// DELETE /api/user/buy/:id
router.delete('/buy/:id', async (req, res) => {
  try {
    const reqDoc = await BuyRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ msg: 'Buy request not found' });
    if (reqDoc.status !== 'Pending') {
      return res.status(403).json({ msg: 'Cannot delete approved/rejected request' });
    }
    await reqDoc.deleteOne();
    res.json({ msg: 'Buy request deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// PUT /api/user/buy/:id
router.put('/buy/:id', async (req, res) => {
  try {
    const { usd } = req.body;
    if (!usd || isNaN(usd) || usd <= 0) {
      return res.status(400).json({ msg: 'Invalid USD value' });
    }

    const reqDoc = await BuyRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ msg: 'Buy request not found' });
    if (reqDoc.status !== 'Pending') {
      return res.status(403).json({ msg: 'Cannot edit approved/rejected request' });
    }

    reqDoc.usd = usd;

    const symbol = reqDoc.symbol.toLowerCase();
    const coingeckoId = ({
      btc: 'bitcoin',
      eth: 'ethereum',
      usdt: 'tether',
      bnb: 'binancecoin'
    }[symbol]) || symbol;

    let price = 1;
    try {
      const resPrice = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );
      const ct = resPrice.headers.get('content-type') || '';
      if (resPrice.ok && ct.includes('application/json')) {
        const priceData = await resPrice.json();
        price = priceData[coingeckoId]?.usd ?? 1;
      }
    } catch (_) {}

    reqDoc.amount = usd / price;
    await reqDoc.save();

    res.json({ msg: 'Buy request updated successfully' });
  } catch (err) {
    console.error('❌ PUT /buy/:id failed:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/user/wallet
router.get('/wallet', async (req, res) => {
  res.json({ wallet: req.currentUser.wallet || {} });
});

// GET /api/user/approved-buys
router.get('/approved-buys', async (req, res) => {
  try {
    const approved = await BuyRequest.find({
      user: req.currentUser.email,
      status: 'Approved'
    }).sort({ timestamp: -1 });
    res.json(approved);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch approved buys', error: err.message });
  }
});

// POST /api/user/sell
router.post('/sell', async (req, res) => {
  const { symbol, amount } = req.body;
  if (!symbol || !amount || amount <= 0) {
    return res.status(400).json({ msg: 'Invalid sell request' });
  }

  try {
    const current = (req.currentUser.wallet && req.currentUser.wallet[symbol]) || 0;
    if (current < amount) {
      return res.status(400).json({ msg: `Not enough ${symbol} to sell` });
    }

    const request = new SellRequest({
      user: req.currentUser.email,
      symbol: symbol.toLowerCase(),
      amount,
      status: 'Pending',
      timestamp: new Date()
    });

    await request.save();
    res.status(201).json({ msg: 'Sell request submitted', request });
  } catch (err) {
    console.error('❌ Failed to submit sell request:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/user/sell/history
router.get('/sell/history', async (req, res) => {
  try {
    const history = await SellRequest.find({ user: req.currentUser.email })
      .sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load sell history', error: err.message });
  }
});

// GET /api/user/buy/history
router.get('/buy/history', async (req, res) => {
  try {
    const history = await BuyRequest.find({ user: req.currentUser.email })
      .sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load buy history', error: err.message });
  }
});

// GET /api/user/me
router.get('/me', async (req, res) => {
  const u = req.currentUser;
  res.json({ id: u._id, name: u.name, email: u.email, isAdmin: !!req.user.isAdmin });
});

module.exports = router;
