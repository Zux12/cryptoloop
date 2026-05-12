const mongoose = require('mongoose');

const BuyRequestSchema = new mongoose.Schema({
  user: { type: String, required: true },

  symbol: { type: String, required: true },
  usd: { type: Number, required: true },
  amount: { type: Number, required: true },

  status: { type: String, default: 'Pending' },

  // ✅ Payment / Transak fields
  paymentMethod: { type: String, default: 'Manual' }, // Manual / Transak
  paymentStatus: { type: String, default: 'Pending Verification' },
  transakOrderId: { type: String, default: '' },
  txHash: { type: String, default: '' },
  walletAddress: { type: String, default: '' },
  network: { type: String, default: '' },
  paidAt: { type: Date },

  timestamp: { type: Date, default: Date.now },
  statusTimestamp: { type: Date }
});

module.exports = mongoose.model('BuyRequest', BuyRequestSchema);
