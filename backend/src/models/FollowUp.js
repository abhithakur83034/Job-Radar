import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    draftMessage: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'linkedin'],
      default: 'email',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const FollowUp = mongoose.model('FollowUp', followUpSchema);

