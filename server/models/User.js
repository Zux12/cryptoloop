// models/User.js
const mongoose = require('mongoose');

const AGENTS = Array.from({ length: 20 }, (_, i) => `AG${1001 + i}`);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, index: true },

    // store the HASHED password (bcrypt result)
    password: { type: String, required: true },

    // agent selected at signup; allow legacy users by permitting UNASSIGNED
    agent: {
      type: String,
      enum: [...AGENTS, 'UNASSIGNED'],
      default: 'UNASSIGNED',
      index: true
    },

    // admin gate
    isApproved: { type: Boolean, default: false, index: true },

    // admins
    isAdmin: { type: Boolean, default: false, index: true },

    // flexible symbol -> amount
    wallet: { type: mongoose.Schema.Types.Mixed, default: {} },

    // audit / login info (optional)
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    lastLoginCity: { type: String },
    lastLoginCountry: { type: String }
  },
  {
    timestamps: true // adds createdAt, updatedAt
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
