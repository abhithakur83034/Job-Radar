import mongoose from 'mongoose';

const gmailConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    // AES-256-GCM encrypted refresh token (see utils/tokenCrypto.js); never returned by the API
    encryptedRefreshToken: {
      type: String,
      required: true,
      select: false,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const GmailConnection = mongoose.model('GmailConnection', gmailConnectionSchema);
