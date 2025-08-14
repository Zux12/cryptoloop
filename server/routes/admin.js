// routes/admin.js
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const BuyRequest = require('../models/BuyRequest');
const SellRequest = require('../models/SellRequest');
const User = require('../models/User');

const router = express.Router();

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/buy-requests
 * List pending buy requests
 */
router.get('/buy-requests', async (req, res) => {
  try {
    const pendingRequests = await BuyRequest.find({ status: 'Pending' })
      .sort({ timestamp: -1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error('❌ Admin buy-requests error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * GET /api/admin/sell-requests
 * List sell requests (all statuses, newest first)
 * If you want only pending, add { status: 'Pending' } to the filter
 */
router.get('/sell-requests', async (req, res) => {
  try {
    const requests = await SellRequest.find({})
      .sort({ timestamp: -1 });
    res.json(requests);
  } catch (err) {
    console.error('❌ Admin sell-requests error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * POST /api/admin/approve
 * Approve a buy request and credit the user's wallet
 * Body: { id }
 */
router.post('/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Buy request not found' });

    if (request.status !== 'Pending') {
      return res.status(400).json({ msg: `Request already ${request.status}` });
    }

    // Credit wallet
    const user = await User.findOne({ email: request.user });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (!user.wallet || typeof user.wallet !== 'object') {
      user.wallet = {};
    }

  // ✅ Ensure agent is set (older users may not have it)
    if (!user.agent) user.agent = 'UNASSIGNED'; // or pick a sensible default like 'AG1001'

    
    const sym = String(request.symbol || '').toLowerCase();
    const amount = Number(request.amount) || 0;

    user.wallet[sym] = (user.wallet[sym] || 0) + amount;
    user.markModified('wallet');
    await user.save();

    // Update request
    request.status = 'Approved';
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: 'Buy request approved and wallet updated' });
  } catch (err) {
    console.error('❌ Admin approval error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * POST /api/admin/sell-approve
 * Approve a sell request and deduct from wallet (only once)
 * Body: { id }
 */
router.post('/sell-approve', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await SellRequest.findById(id);
    if (!request) {
      return res.status(404).json({ msg: 'Sell request not found' });
    }
    if (request.status !== 'Pending' && request.status !== 'Frozen') {
      return res.status(400).json({ msg: `Cannot approve request in status: ${request.status}` });
    }

    const user = await User.findOne({ email: request.user });
    if (!user) return res.status(404).json({ msg: 'User not found' });

  
    if (!user.wallet || typeof user.wallet !== 'object') user.wallet = {};
    if (!user.agent) user.agent = 'UNASSIGNED'; // ✅ fallback

    const sym = String(request.symbol || '').toLowerCase();
    const amount = Number(request.amount) || 0;
    const owned = Number(user.wallet[sym] || 0);

    if (owned < amount) {
      return res.status(400).json({ msg: `User does not have enough ${sym}` });
    }

    // Deduct once
    user.wallet[sym] = owned - amount;
    user.markModified('wallet');
    await user.save();

    request.status = 'Approved';
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: 'Sell request approved and wallet updated' });
  } catch (err) {
    console.error('❌ Error approving sell request:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * POST /api/admin/sell-reject
 * Reject a sell request (no wallet changes)
 * Body: { id }
 */
router.post('/sell-reject', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await SellRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (request.status !== 'Pending' && request.status !== 'Frozen') {
      return res.status(400).json({ msg: `Cannot reject request in status: ${request.status}` });
    }

    request.status = 'Rejected';
    request.statusTimestamp = new Date();
    await request.save();

    res.json({ msg: 'Sell request rejected' });
  } catch (err) {
    console.error('❌ Error rejecting sell request:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/**
 * POST /api/admin/sell-update
 * Generalized status update: Approve / Reject / Frozen / Transfer
 * Body: { id, status }
 * - Deduct from wallet only when moving from Pending → (Approved|Frozen|Transfer)
 */
router.post('/sell-update', async (req, res) => {
  const { id, status } = req.body;
  const normalized = String(status || '').toLowerCase();

  if (!['approve', 'approved', 'reject', 'rejected', 'frozen', 'freeze', 'transfer'].includes(normalized)) {
    return res.status(400).json({ msg: 'Invalid status' });
  }

  try {
    const request = await SellRequest.findById(id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const fromStatus = String(request.status || 'Pending');
    const toStatus =
      normalized === 'approve' ? 'Approved' :
      normalized === 'rejected' ? 'Rejected' :
      normalized === 'reject' ? 'Rejected' :
      normalized === 'freeze' ? 'Frozen' :
      normalized === 'frozen' ? 'Frozen' :
      normalized === 'transfer' ? 'Transfer' :
      'Approved';

    const shouldDeduct = (fromStatus === 'Pending') && ['Approved', 'Frozen', 'Transfer'].includes(toStatus);

    // Wallet mutation only once when moving out of Pending to a deducting state
    if (shouldDeduct) {
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

module.exports = router;
