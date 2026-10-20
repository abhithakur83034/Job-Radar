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

export const User = mongoose.model('User', userSchema);

