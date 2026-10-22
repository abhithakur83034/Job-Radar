import mongoose from 'mongoose';

/**
 * One-time password reset token. Only the SHA-256 hash is stored, so a database
 * leak can't be used to reset passwords. Expired tokens are removed by a TTL index.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdBy: { type: String, enum: ['self', 'admin'], default: 'self' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
