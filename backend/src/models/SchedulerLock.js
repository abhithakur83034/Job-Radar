import mongoose from 'mongoose';

/**
 * Lease-based lock so only one backend instance runs a scheduled task at a time.
 * A crashed holder's lease simply expires.
 */
const schedulerLockSchema = new mongoose.Schema(
  {
    _id: { type: String }, // task name
    owner: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
  },
  { versionKey: false }
);

export const SchedulerLock = mongoose.model('SchedulerLock', schedulerLockSchema);

export async function acquireLock(name, owner, ttlMs) {
  const now = new Date();
  try {
    await SchedulerLock.findOneAndUpdate(
      { _id: name, lockedUntil: { $lt: now } },
      { owner, lockedUntil: new Date(now.getTime() + ttlMs) },
      { upsert: true }
    );
    return true;
  } catch (err) {
    // Duplicate key: the lock exists and its lease hasn't expired
    if (err.code === 11000) return false;
    throw err;
  }
}

export async function releaseLock(name, owner) {
  await SchedulerLock.deleteOne({ _id: name, owner });
}
