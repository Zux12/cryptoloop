const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest'); // ⬅️ Create this model if not already
const User = require('../models/User');

const router = express.Router();

// 🟢 GET Buy History
router.get('/buy/history', authMiddleware, async (req, res) => {
  try {
    console.log("📥 req.user:", req.user);
    const history = await BuyRequest.find({ user: req.user.email }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// 🔐 Create a Buy Request
router.post('/buy', authMiddleware, async (req, res) => {
    const { symbol, usd } = req.body;
  
    if (!symbol || !usd) {
      return res.status(400).json({ msg: 'Missing symbol or USD amount' });
    }
  
    try {
      const coingeckoId = {
        btc: 'bitcoin',
        eth: 'ethereum',
        usdt: 'tether',
        bnb: 'binancecoin'
      }[symbol.toLowerCase()] || symbol;
  
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`);
     
      if (!response.ok) {
      console.error("❌ CoinGecko API failed:", response.status);
      return res.status(500).json({ msg: 'CoinGecko API failed' });
      }

      
      const data = await response.json();

      console.log("🔍 Fetching price for:", coingeckoId);
      console.log("🧾 USD amount submitted:", usd);
      console.log("🪙 CoinGecko response:", data);
      console.log("💰 Calculated price:", data[coingeckoId]?.usd);

      const price = data[coingeckoId]?.usd || 1;
      const amount = usd / price;

      console.log("🧮 Calculated amount:", amount);
  
      const request = new BuyRequest({

        user: req.user.email,
        symbol,
        usd,
        amount,
        status: 'Pending'

      });

      console.log("💾 Saving buy request:", { symbol, usd, user: req.user.email });

  
      await request.save();
      console.log("✅ Buy request successfully saved in DB:", request); // 🟢 ADD THIS
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
      console.error("❌ Failed to fetch price or save request:", err);
      res.status(500).json({ msg: 'Failed to save request', error: err.message });
    }
  });




// 🗑️ Delete a Buy Request (Pending only)
router.delete('/buy/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
  
      const request = await BuyRequest.findById(id);
      if (!request) return res.status(404).json({ msg: 'Buy request not found' });
  
      // ✅ Only allow deletion if status is "Pending"
      if (request.status !== 'Pending') {
        return res.status(403).json({ msg: 'Cannot delete approved/rejected request' });
      }
  
      await request.deleteOne();
      res.json({ msg: 'Buy request deleted successfully' });
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  

  // ✏️ Update USD of a Buy Request (Pending only)
router.put('/buy/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { usd } = req.body;
  
      if (!usd || isNaN(usd) || usd <= 0) {
        return res.status(400).json({ msg: 'Invalid USD value' });
      }
  
      const request = await BuyRequest.findById(id);
      if (!request) return res.status(404).json({ msg: 'Buy request not found' });
  
      if (request.status !== 'Pending') {
        return res.status(403).json({ msg: 'Cannot edit approved/rejected request' });
      }
  
      request.usd = usd;
  
      // Recalculate amount (you can reuse your pricing logic here or set placeholder)
      const symbol = request.symbol.toLowerCase();
      const coingeckoId = {
        btc: 'bitcoin',
        eth: 'ethereum',
        usdt: 'tether',
        bnb: 'binancecoin'
      }[symbol] || symbol;
  
      const resPrice = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`);
      const priceData = await resPrice.json();
      const price = priceData[coingeckoId]?.usd || 1;
  
      request.amount = usd / price;
      await request.save();
  
      res.json({ msg: 'Buy request updated successfully' });
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  


  //wallet

  router.get('/wallet', authMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      res.json({ wallet: user.wallet || {} });
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  

  // 🟢 Get all approved buy records for selling
router.get('/approved-buys', authMiddleware, async (req, res) => {
    try {
      const approved = await BuyRequest.find({ user: req.user.email, status: 'Approved' }).sort({ timestamp: -1 });
      res.json(approved);
    } catch (err) {
      res.status(500).json({ msg: 'Failed to fetch approved buys', error: err.message });
    }
  });
  



// 🟡 Submit Sell Request
router.post('/sell', authMiddleware, async (req, res) => {
    console.log("📩 Sell request body:", req.body);

  const { id, symbol, amount } = req.body;

  if (!symbol || !amount || amount <= 0) {
    return res.status(400).json({ msg: 'Invalid sell request' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const current = user.wallet[symbol] || 0;
    if (current < amount) {
      return res.status(400).json({ msg: `Not enough ${symbol} to sell` });
    }


    // ✅ Save sell request to DB
    const request = new SellRequest({

        user: req.user.email,
        symbol: symbol.toLowerCase(),
        amount,
        status: 'Pending'
      });

      await request.save();
      console.log("💾 Sell request saved:", request);
  
      res.status(201).json({ msg: 'Sell request submitted', request });
    } catch (err) {
      console.error("❌ Failed to submit sell request:", err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });



  // 🟣 Get Past Sell History (all statuses)
  router.get('/sell/history', authMiddleware, async (req, res) => {
    try {
      const history = await SellRequest.find({ user: req.user.email }).sort({ timestamp: -1 });
      res.json(history);
    } catch (err) {
      console.error("❌ Error loading sell history:", err.message);
      res.status(500).json({ msg: 'Failed to load sell history', error: err.message });
    }
  });
  


  module.exports = router;
