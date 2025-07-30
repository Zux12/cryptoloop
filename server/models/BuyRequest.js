const mongoose = require('mongoose');

const BuyRequestSchema = new mongoose.Schema({
  user: { type: String, required: true },           // user's email
  symbol: { type: String, required: true },
  usd: { type: Number, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },     // Pending, Approved, Rejected
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BuyRequest', BuyRequestSchema);
