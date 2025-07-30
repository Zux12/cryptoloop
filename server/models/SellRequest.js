const mongoose = require('mongoose');

const SellRequestSchema = new mongoose.Schema({
  user: { type: String, required: true },       // user email
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' }, // Pending, Approved, Rejected
  timestamp: { type: Date, default: Date.now },
  statusTimestamp: { type: Date }

});

module.exports = mongoose.model('SellRequest', SellRequestSchema);
