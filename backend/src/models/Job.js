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
    // Hidden by an admin (e.g. spam or invalid). Separate from isActive so a source
    // refresh that still lists the job never un-hides it.
    adminHidden: { type: Boolean, default: false },
    moderationReason: { type: String, default: null, maxlength: 500 },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

jobSchema.index({ source: 1, externalId: 1 }, { unique: true });
jobSchema.index({ foundAt: -1 });
jobSchema.index({ source: 1, company: 1, lastSeenAt: 1 });
jobSchema.index({ isActive: 1, source: 1 });

export const Job = mongoose.model('Job', jobSchema);

