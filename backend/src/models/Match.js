import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    fitScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    fitReason: {
      type: String,
      default: '',
    },
    matchedSkills: {
      type: [String],
      default: [],
    },
    missingRequirements: {
      type: [String],
      default: [],
    },
    saved: {
      type: Boolean,
      default: false,
    },
    // "Not interested": hidden from the feed and never re-surfaced by rescoring
    dismissed: {
      type: Boolean,
      default: false,
    },
    // When a notification about this match was sent (null = not notified)
    alertedAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

matchSchema.index({ userId: 1, profileId: 1, jobId: 1 }, { unique: true });
matchSchema.index({ userId: 1, fitScore: -1, createdAt: -1 });

export const Match = mongoose.model('Match', matchSchema);

