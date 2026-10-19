import mongoose from 'mongoose';

const tailoredDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      unique: true,
    },
    resumeDraft: {
      type: String,
      required: true,
    },
    coverLetterDraft: {
      type: String,
      required: true,
    },
    changesMade: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const TailoredDraft = mongoose.model('TailoredDraft', tailoredDraftSchema);

