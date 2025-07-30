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
  }
});

module.exports = mongoose.model('CryptoAISim', cryptoAISimSchema);
