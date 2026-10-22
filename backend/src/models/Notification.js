import mongoose from 'mongoose';

/** In-app notification (also delivered as a browser push when the user enabled it). */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['new_matches'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 1000 },
    url: { type: String, default: '/feed' }, // in-app path only
    matchIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
