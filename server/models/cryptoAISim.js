const mongoose = require('mongoose');

const cryptoAISimSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  simulatedValue: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date,
    required: true
  },
    // NEW: persistent baseline so UI doesn't jump when wallet/TPV changes
  baseValue: { type: Number, default: null }
});

module.exports = mongoose.model('CryptoAISim', cryptoAISimSchema);
