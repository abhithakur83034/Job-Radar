import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    parsedData: {
      summary: { type: String, default: '' },
      skills: { type: [String], default: [] },
      roles: { type: [String], default: [] },
      experience: { type: String, default: '' },
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

resumeSchema.index({ userId: 1, uploadedAt: -1 });

export const Resume = mongoose.model('Resume', resumeSchema);

