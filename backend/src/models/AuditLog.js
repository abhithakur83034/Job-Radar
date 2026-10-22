import mongoose from 'mongoose';

/**
 * Record of sensitive administrative actions (role/status changes, job moderation,
 * refresh triggers, settings updates). Never stores secrets or résumé content.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorLabel: { type: String, default: 'system' }, // username/email at the time of the action
    action: { type: String, required: true }, // e.g. user.role.update, job.status.update
    targetType: { type: String, default: null }, // user | job | settings | job-refresh
    targetId: { type: String, default: null },
    targetLabel: { type: String, default: null },
    reason: { type: String, default: null, maxlength: 500 },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    // Small, sanitized before/after values (e.g. { from: 'user', to: 'admin' })
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
