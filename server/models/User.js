const mongoose = require('mongoose');

const AGENTS = Array.from({ length: 20 }, (_, i) => `AG${1001 + i}`);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },
    // Store a HASHED password string here (bcrypt result), even if the field is named "password"
    password: {
      type: String,
      required: true
    },
    // New: which agent the user selected during signup
    agent: {
      type: String,
      enum: AGENTS,
      required: true
    },
    // New: admin must approve before login works
    isApproved: {
      type: Boolean,
      default: false,
      index: true
    },
    // New: mark admin users
    isAdmin: {
      type: Boolean,
      default: false,
      index: true
    },
    // You already had wallet — keep as-is
    wallet: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // New: record creation time
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    // Optional: also add updatedAt automatically
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

// Defensive: avoid model overwrite in dev hot-reload
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
