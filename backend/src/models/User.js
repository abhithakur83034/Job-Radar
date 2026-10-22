import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    // Sign-in identifiers. Optional at the schema level so accounts created before
    // username/mobile sign-in existed stay valid (they can still sign in with email).
    username: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 30,
    },
    // E.164, e.g. +919876543210 (see utils/identity.js)
    mobile: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    // Company job-board slugs (Greenhouse/Lever/Ashby) this user scans
    scanCompanies: {
      type: [String],
      default: [],
    },
    // Suspended accounts can't sign in or use the API (set by admins; missing = active)
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    // Sessions issued before this time are rejected (set when the password is reset)
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    // Last authenticated request (updated at most every few minutes); drives "active users"
    lastActiveAt: {
      type: Date,
      default: null,
    },
    // Companies the user marked "not interested"; their jobs never become matches
    hiddenCompanies: {
      type: [String],
      default: [],
    },
    // Alerts for strong new matches
    notificationPrefs: {
      minScore: { type: Number, default: 80, min: 50, max: 100 },
      push: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Unique only among accounts that have set them (older accounts may have neither)
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActiveAt: -1 });

export const User = mongoose.model('User', userSchema);

