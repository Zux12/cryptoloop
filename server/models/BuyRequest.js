const mongoose = require('mongoose');

const BuyRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String
  },
  symbol: { type: String, required: true },
  usd: { type: Number, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BuyRequest', BuyRequestSchema);
