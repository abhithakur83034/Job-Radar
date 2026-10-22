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
    // Last scan that still listed this job; stale values mean it was likely closed
    lastSeenAt: {
      type: Date,
      default: null,
    },
    // Optional canonical fields from richer sources (absent on older records)
    applyUrl: { type: String, default: null },
    postedAt: { type: Date, default: null },
    remoteType: { type: String, enum: ['remote', 'hybrid', 'onsite', 'unknown'], default: 'unknown' },
    employmentType: { type: String, default: null },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    salaryCurrency: { type: String, default: null },
    // false once a complete refresh of the job's employer board no longer lists it.
    // Missing on older records, which count as active.
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

jobSchema.index({ source: 1, externalId: 1 }, { unique: true });
jobSchema.index({ foundAt: -1 });
jobSchema.index({ source: 1, company: 1, lastSeenAt: 1 });

export const Job = mongoose.model('Job', jobSchema);

