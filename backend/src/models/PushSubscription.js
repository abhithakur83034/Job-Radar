import mongoose from 'mongoose';

/** A browser's Web Push subscription for one user (one per device/browser). */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true, versionKey: false }
);

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
