const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest');
const User = require('../models/User');

const router = express.Router();

/**
 * All /api/user routes require auth.
 * Also attach the current user document so we always have name/email/wallet.
 */
router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    // req.user.uid is set by requireAuth (from the JWT)
    const u = await User.findById(req.user.uid).select('name email wallet');
    if (!u) return res.status(404).json({ msg: 'User not found' });
    req.currentUser = u; // { name, email, wallet }
    next();
  } catch (e) {
    console.error('attach currentUser error:', e);
    next(e);
  }
});

/**
 * POST /api/user/buy
 * Submit buy request
 */
router.post('/buy', async (req, res) => {
  const { symbol, usd } = req.body;

  if (!symbol || !usd) {
    return res.status(400).json({ msg: 'Missing symbol or USD amount' });
  }

  try {
    const coingeckoId =
      {
        btc: 'bitcoin',
        eth: 'ethereum',
        usdt: 'tether',
        bnb: 'binancecoin',
      }[symbol.toLowerCase()] || symbol;

    // Use global fetch (Node 18+) or polyfill if needed
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );

    let price = 1; // fallback
    const contentType = response.headers.get('content-type') || '';

    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      price = data[coingeckoId]?.usd ?? 1;
      console.log(`🔍 CoinGecko price: ${price}`);
    } else {
      console.warn(`⚠️ CoinGecko failed. Using fallback price = ${price}`);
    }

    const amount = usd / price;

    const request = new BuyRequest({
      user: req.currentUser.email,   // ✅ email from DB
      symbol,
      usd,
      amount,
      status: 'Pending',
      timestamp: new Date(),
    });

    await request.save();
    console.log('✅ Buy request saved:', request);

    res.status(201).json({
      msg: 'Buy request submitted successfully',
      request: {
        symbol: request.symbol,
        usd: request.usd,
        amount: request.amount,
        status: request.status,
        timestamp: request.timestamp,
      },
    });
  } catch (err) {
    console.error('❌ Failed in /buy:', err.message);
    res.status(500).json({ msg: 'Failed to save request', error: err.message });
  }
});

/**
 * DELETE /api/user/buy/:id
 * Delete pending buy request
 */
router.delete('/buy/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Buy request not found' });

    if (request.status !== 'Pending') {
      return res.status(403).json({ msg: 'Cannot delete approved/rejected request' });
    }

    await request.deleteOne();
    res.json({ msg: 'Buy request deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * PUT /api/user/buy/:id
 * Update USD of pending buy request
 */
router.put('/buy/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { usd } = req.body;

    console.log('✏️ PUT /buy/:id hit:', id, 'new USD:', usd);

    if (!usd || isNaN(usd) || usd <= 0) {
      return res.status(400).json({ msg: 'Invalid USD value' });
    }

    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Buy request not found' });

    if (request.status !== 'Pending') {
      return res.status(403).json({ msg: 'Cannot edit approved/rejected request' });
    }

    request.usd = usd;

    const symbol = request.symbol.toLowerCase();
    const coingeckoId =
      {
        btc: 'bitcoin',
        eth: 'ethereum',
        usdt: 'tether',
        bnb: 'binancecoin',
      }[symbol] || symbol;

    // get price
    let price = 1;
    try {
      const resPrice = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );
      const contentType = resPrice.headers.get('content-type') || '';

      console.log('🌐 CoinGecko PUT response status:', resPrice.status);
      console.log('🌐 CoinGecko PUT headers:', contentType);

      if (resPrice.ok && contentType.includes('application/json')) {
        const priceData = await resPrice.json();
        price = priceData[coingeckoId]?.usd ?? 1;
      } else {
        console.warn('⚠️ CoinGecko returned non-JSON or error. Using fallback price = 1');
      }
    } catch (err) {
      console.warn('⚠️ CoinGecko request failed. Using fallback price = 1');
    }

    request.amount = usd / price;
    await request.save();

    res.json({ msg: 'Buy request updated successfully' });
  } catch (err) {
    console.error('❌ PUT /buy/:id failed:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * GET /api/user/wallet
 */
router.get('/wallet', async (req, res) => {
  try {
    // We attached the user above
    res.json({ wallet: req.currentUser.wallet || {} });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * GET /api/user/approved-buys
 */
router.get('/approved-buys', async (req, res) => {
  try {
    const approved = await BuyRequest.find({
      user: req.currentUser.email,
      status: 'Approved',
    }).sort({ timestamp: -1 });
    res.json(approved);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch approved buys', error: err.message });
  }
});

/**
 * POST /api/user/sell
 * Submit sell request
 */
router.post('/sell', async (req, res) => {
  console.log('📩 Sell request body:', req.body);

  const { symbol, amount } = req.body;
  if (!symbol || !amount || amount <= 0) {
    return res.status(400).json({ msg: 'Invalid sell request' });
  }

  try {
    const userDoc = req.currentUser; // already loaded
    const current = (userDoc.wallet && userDoc.wallet[symbol]) || 0;
    if (current < amount) {
      return res.status(400).json({ msg: `Not enough ${symbol} to sell` });
    }

    const request = new SellRequest({
      user: req.currentUser.email,     // ✅ email string (consistent with your schema)
      symbol: symbol.toLowerCase(),
      amount,
      status: 'Pending',
      timestamp: new Date(),
    });

    await request.save();
    console.log('💾 Sell request saved:', request);

    res.status(201).json({ msg: 'Sell request submitted', request });
  } catch (err) {
    console.error('❌ Failed to submit sell request:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * GET /api/user/sell/history
 */
router.get('/sell/history', async (req, res) => {
  try {
    const history = await SellRequest.find({ user: req.currentUser.email })
      .sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    console.error('❌ Error loading sell history:', err.message);
    res.status(500).json({ msg: 'Failed to load sell history', error: err.message });
  }
});

/**
 * GET /api/user/buy/history
 */
router.get('/buy/history', async (req, res) => {
  try {
    const history = await BuyRequest.find({ user: req.currentUser.email })
      .sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    console.error('❌ Error loading buy history:', err.message);
    res.status(500).json({ msg: 'Failed to load buy history', error: err.message });
  }
});

/**
 * GET /api/user/me
 * Return current user's basic profile
 */
router.get('/me', async (req, res) => {
  try {
    const u = req.currentUser; // already loaded
    res.json({ id: u._id, name: u.name, email: u.email });
  } catch (e) {
    console.error('GET /me error:', e);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
