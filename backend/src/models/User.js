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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Unique only among accounts that have set them (older accounts may have neither)
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } });

export const User = mongoose.model('User', userSchema);

