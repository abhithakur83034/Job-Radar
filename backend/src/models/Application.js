import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
    },
    status: {
      type: String,
      enum: ['applied', 'interviewing', 'followup', 'rejected', 'offer'],
      default: 'applied',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdateAt: {
      type: Date,
      default: Date.now,
    },
    nextFollowupAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

applicationSchema.index({ userId: 1, appliedAt: -1 });
applicationSchema.index({ userId: 1, lastUpdateAt: -1 });

export const Application = mongoose.model('Application', applicationSchema);

