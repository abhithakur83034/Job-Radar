import mongoose from 'mongoose';

/** Last refresh outcome per background job source (one document per provider id). */
const jobSourceStatusSchema = new mongoose.Schema(
  {
    _id: { type: String }, // provider id, e.g. "remotive"
    lastAttemptAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['success', 'failed'], default: null },
    lastDurationMs: { type: Number, default: null },
    lastFetched: { type: Number, default: 0 }, // valid listings after normalization
    lastRejected: { type: Number, default: 0 }, // malformed listings dropped
    // Sanitized summary only (error code + short message), never raw payloads or secrets
    lastError: { type: String, default: null },
    consecutiveFailures: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

export const JobSourceStatus = mongoose.model('JobSourceStatus', jobSourceStatusSchema);
