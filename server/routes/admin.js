const express = require('express');
const router = express.Router();
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');


router.get('/buy-requests', authMiddleware, async (req, res) => {
    console.log("📡 /api/admin/buy-requests called by:", req.user?.email);
  
    try {
      const pendingRequests = await BuyRequest.find({ status: 'Pending' }).sort({ timestamp: -1 });
      console.log("📦 Pending found:", pendingRequests.length);
      res.json(pendingRequests);
    } catch (err) {
      console.error("❌ Admin fetch error:", err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  






router.get('/sell-requests', authMiddleware, async (req, res) => {
    console.log("🕵️ Admin Route - req.user:", req.user); // DEBUG

  if (!req.user.isAdmin) {
    return res.status(403).json({ msg: 'Unauthorized' }); // ✅ THIS IS CORRECT
  }
  
    try {
      const requests = await SellRequest.find({}).sort({ timestamp: -1 });
      console.log("📡 /api/admin/sell-requests called by:", req.user.email);
      console.log("📦 Pending SellRequests found:", requests.length);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
    console.log("🔐 Admin Token Verified:", req.user);

  });
  
  
  

// ✅ Admin Approve Buy Request — final version
router.post('/approve', authMiddleware, async (req, res) => {
    const { id } = req.body;
  
    try {
      console.log("🔍 Approve request ID:", id);
  
      const request = await BuyRequest.findById(id);
      if (!request) return res.status(404).json({ msg: 'Buy request not found' });
  
      console.log("🧾 Found buy request:", request);
  
      request.status = 'Approved';
      await request.save();
  
      const user = await User.findOne({ email: request.user });
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      console.log("👤 Found user:", user.email);
  
     // Ensure wallet exists and is an object
// Merge-safe logic
if (!user.wallet || typeof user.wallet !== 'object') {
    user.wallet = {};
    console.log("🧱 Initialized new wallet object");
  }
  
  const sym = request.symbol.toLowerCase();
  const amount = Number(request.amount);
  
  console.log(`➕ Adding ${amount} ${sym} to wallet`);
  
  user.wallet[sym] = (user.wallet[sym] || 0) + amount;
  
  console.log("💾 Saving updated wallet:", user.wallet);
  
  // ✅ Force Mongoose to treat wallet as modified
  user.markModified('wallet');
  
  console.log("🧠 Pre-save wallet object:", user.wallet);
  
  await user.save().then(() => console.log("🔥 Final wallet save confirmed"));
  
  console.log("✅ Wallet saved successfully.");
  
  

      res.json({ msg: 'Buy request approved and wallet updated' });
    } catch (err) {
      console.error("❌ Admin approval error:", err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  
  

  // 🟢 Get all pending sell requests
  router.get('/sell-requests', authMiddleware, async (req, res) => {
    console.log("📡 /api/admin/buy-requests called by:", req.user?.email);
    if (!req.user.isAdmin) return res.status(403).json({ msg: 'Unauthorized' });
  
    try {
        const requests = await SellRequest.find().sort({ timestamp: -1 });

      console.log("📡 /api/admin/sell-requests called by:", req.user.email);
      console.log("📦 Pending SellRequests found:", requests.length);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  
  

// ✅ Approve Sell Request
router.post('/sell-approve', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ msg: 'Unauthorized' });
  
    const { id } = req.body;
  
    try {
      const request = await SellRequest.findById(id);
      if (!request || request.status !== 'Pending') {
        return res.status(404).json({ msg: 'Sell request not found or already handled' });
      }
  
      const user = await User.findOne({ email: request.user });
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      const symbol = request.symbol.toLowerCase();
      const owned = user.wallet[symbol] || 0;
  
      if (owned < request.amount) {
        return res.status(400).json({ msg: `User does not have enough ${symbol}` });
      }
  
      // Update wallet
      user.wallet[symbol] = owned - request.amount;
      user.markModified('wallet');
      await user.save();
  
      request.status = 'Approved';
      await request.save();
  
      res.json({ msg: 'Sell request approved and wallet updated' });
    } catch (err) {
      res.status(500).json({ msg: 'Error approving sell', error: err.message });
    }
  });

  

  router.post('/sell-reject', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ msg: 'Unauthorized' });
  
    const { id } = req.body;
  
    try {
      const request = await SellRequest.findById(id);
      if (!request || request.status !== 'Pending') {
        return res.status(404).json({ msg: 'Request not found' });
      }
  
      request.status = 'Rejected';
      await request.save();
  
      res.json({ msg: 'Sell request rejected' });
    } catch (err) {
      res.status(500).json({ msg: 'Error rejecting request', error: err.message });
    }
  });
  


  // ✅ Generalized Sell Status Update (Approve / Reject / Frozen / Transfer)
router.post('/sell-update', authMiddleware, async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ msg: 'Unauthorized' });
  
    const { id, status } = req.body;
  
    try {
      const request = await SellRequest.findById(id);
      if (!request || request.status === status) {
        return res.status(400).json({ msg: 'Request not found or already set' });
      }
  
      const user = await User.findOne({ email: request.user });
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      const sym = request.symbol.toLowerCase();
      const amount = Number(request.amount);
  
      if (['approve', 'frozen', 'transfer'].includes(status.toLowerCase())) {
        const owned = user.wallet?.[sym] || 0;
        if (owned < amount) {
          return res.status(400).json({ msg: `User does not have enough ${sym}` });
        }
        user.wallet[sym] = owned - amount;
        user.markModified('wallet');
        await user.save();
      }
  
      request.status = status.charAt(0).toUpperCase() + status.slice(1);
      request.statusTimestamp = new Date();
      await request.save();
  
      res.json({ msg: `Request updated to ${request.status}`, request });
    } catch (err) {
      console.error("❌ Error updating sell request:", err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
  


module.exports = router;
