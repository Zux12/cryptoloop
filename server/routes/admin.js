// routes/admin.js
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest');
const User = require('../models/User');

const router = express.Router();

// --- health check to confirm the router is mounted ---
router.get('/ping', (req, res) => res.json({ ok: true, scope: 'admin' }));

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

/* =========================
 * USERS (Admin approval)
 * ========================= */

// List users for approval table
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email agent isApproved createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    console.error('GET /admin/users error:', e);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Your admin.html calls PATCH /api/admin/approve/:id to approve a USER
router.patch('/approve/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: 'User not found' });

    // Some older users might not have agent set — avoid schema validation error
    if (!u.agent) u.agent = 'UNASSIGNED';

    u.isApproved = true;
    await u.save();
    res.json({ msg: 'User approved', id: u._id });
  } catch (e) {
    console.error('PATCH /admin/approve/:id error:', e);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Your admin.html calls PATCH /api/admin/reject/:id to remove a USER
router.patch('/reject/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ msg: 'User not found' });

    await u.deleteOne();
    res.json({ msg: 'User removed', id: req.params.id });
  } catch (e) {
    console.error('PATCH /admin/reject/:id error:', e);
    res.status(500).json({ msg: 'Server error' });
  }
});

/* =========================
 * BUY REQUESTS
 * ========================= */

// List pending buy requests (your admin.html calls GET /api/admin/buy-requests)
router.get('/buy-requests', async (req, res) => {
  try {
    const pendingRequests = await BuyRequest.find({ status: 'Pending' }).sort({ timestamp: -1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error('❌ Admin buy-requests error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Approve a BUY request (admin.html posts to /api/admin/approve with {id})
router.post('/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Buy request not found' });

    if (request.status !== 'Pending') {
      return res.status(400).json({ msg: `Request already ${request.status}` });
    }

    const user = await User.findOne({ email: request.user });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (!user.wallet || typeof user.wallet !== 'object') user.wallet = {};
    if (!user.agent) user.agent = 'UNASSIGNED'; // avoid schema required error

    const sym = String(request.symbol || '').toLowerCase();
    const amount = Number(request.amount) || 0;

    user.wallet[sym] = (user.wallet[sym] || 0) + amount;
    user.markModified('wallet');
    await user.save();

    request.status = 'Approved';
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: 'Buy request approved and wallet updated' });
  } catch (err) {
    console.error('❌ Admin approval error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Reject a BUY request (admin.html posts to /api/admin/reject with {id})
router.post('/reject', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Buy request not found' });

    if (request.status !== 'Pending') {
      return res.status(400).json({ msg: `Request already ${request.status}` });
    }

    request.status = 'Rejected';
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: 'Buy request rejected' });
  } catch (err) {
    console.error('❌ Admin reject-buy error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* =========================
 * SELL REQUESTS
 * ========================= */

// List sell requests (your admin.html calls GET /api/admin/sell-requests)
router.get('/sell-requests', async (req, res) => {
  try {
    const requests = await SellRequest.find({}).sort({ timestamp: -1 });
    res.json(requests);
  } catch (err) {
    console.error('❌ Admin sell-requests error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Generalized sell status update (admin.html posts to /api/admin/sell-update)
router.post('/sell-update', async (req, res) => {
  const { id, status } = req.body;
  const normalized = String(status || '').toLowerCase();

  if (!['approve', 'approved', 'reject', 'rejected', 'frozen', 'freeze', 'transfer'].includes(normalized)) {
    return res.status(400).json({ msg: 'Invalid status' });
  }

  try {
    const request = await SellRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const toStatus =
      normalized === 'approve' ? 'Approved' :
      normalized === 'approved' ? 'Approved' :
      normalized === 'reject' ? 'Rejected' :
      normalized === 'rejected' ? 'Rejected' :
      normalized === 'freeze' ? 'Frozen' :
      normalized === 'frozen' ? 'Frozen' :
      normalized === 'transfer' ? 'Transfer' :
      'Approved';

    // Deduct only the first time it leaves Pending into a deducting state
    const movingOutOfPending = request.status === 'Pending' && ['Approved', 'Frozen', 'Transfer'].includes(toStatus);

    if (movingOutOfPending) {
      const user = await User.findOne({ email: request.user });
      if (!user) return res.status(404).json({ msg: 'User not found' });

      if (!user.wallet || typeof user.wallet !== 'object') user.wallet = {};
      if (!user.agent) user.agent = 'UNASSIGNED';

      const sym = String(request.symbol || '').toLowerCase();
      const amount = Number(request.amount) || 0;
      const owned = Number(user.wallet[sym] || 0);

      if (owned < amount) {
        return res.status(400).json({ msg: `User does not have enough ${sym}` });
      }

      user.wallet[sym] = owned - amount;
      user.markModified('wallet');
      await user.save();
    }

    request.status = toStatus;
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: `Request updated to ${request.status}`, request });
  } catch (err) {
    console.error('❌ Error updating sell request:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/admin/users/overview
// Returns: [{ _id, name, email, agent, isApproved, createdAt, lastLoginAt, lastLoginIp, wallet, aiSim: { simulatedValue, lastUpdated } }]
const CryptoAISim = require('../models/CryptoAISim');

router.get('/users/overview', async (req, res) => {
  try {
    // 1) pull users (light projection keeps payload small)
    const users = await User.find({}, 'name email agent isApproved createdAt lastLoginAt lastLoginIp wallet').lean();

    // 2) map userIds to get AI sims in one query
    const ids = users.map(u => u._id);
    const sims = await CryptoAISim.find({ userId: { $in: ids } }, 'userId simulatedValue lastUpdated').lean();
    const simMap = new Map(sims.map(s => [String(s.userId), s]));

    // 3) attach aiSim to each user
    const out = users.map(u => ({
      ...u,
      aiSim: simMap.get(String(u._id)) || null
    }));

    res.json(out);
  } catch (e) {
    console.error('❌ /api/admin/users/overview:', e);
    res.status(500).json({ msg: 'Server error' });
  }
});



module.exports = router;
