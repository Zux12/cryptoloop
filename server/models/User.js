const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  wallet: {
    type: mongoose.Schema.Types.Mixed, // 👈 Not just "Object"
    default: {}
  }
  
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

