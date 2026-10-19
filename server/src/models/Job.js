import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    salaryText: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      required: true,
    },
    foundAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

jobSchema.index({ source: 1, externalId: 1 }, { unique: true });
jobSchema.index({ foundAt: -1 });

export const Job = mongoose.model('Job', jobSchema);

