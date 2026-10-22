import mongoose from 'mongoose';

/** History of background/manual job refresh runs, for the admin portal. */
const jobRefreshRunSchema = new mongoose.Schema(
  {
    trigger: { type: String, required: true }, // scheduler | admin | test
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['running', 'completed', 'partial', 'failed'], default: 'running' },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    // Per-source outcome: { id, status, fetched, error } with sanitized error summaries only
    providers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    newListings: { type: Number, default: 0 },
    newMatches: { type: Number, default: 0 },
    closedJobs: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { versionKey: false }
);

jobRefreshRunSchema.index({ startedAt: -1 });

export const JobRefreshRun = mongoose.model('JobRefreshRun', jobRefreshRunSchema);
