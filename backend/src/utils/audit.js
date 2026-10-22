import { AuditLog } from '../models/AuditLog.js';

/** Who performed an action, for audit records. */
export function actorOf(user) {
  if (!user) return { actorId: null, actorLabel: 'system' };
  return { actorId: user._id, actorLabel: user.username || user.email || String(user._id) };
}

/**
 * Write an audit record. Auditing must never break the action itself, so failures
 * are logged (without payloads) and swallowed.
 */
export async function audit(user, { action, targetType = null, targetId = null, targetLabel = null, reason = null, outcome = 'success', changes = null }) {
  try {
    await AuditLog.create({
      ...actorOf(user),
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetLabel,
      reason: reason ? String(reason).slice(0, 500) : null,
      outcome,
      changes,
    });
  } catch (err) {
    console.error(`[Audit] Failed to record ${action}:`, err.message);
  }
}
