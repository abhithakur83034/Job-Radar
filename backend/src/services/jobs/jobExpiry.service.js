import { env } from '../../config/env.js';
import { Job } from '../../models/Job.js';
import { fetchJson } from '../../utils/safeFetch.js';

// Sources whose feeds only show recent postings and offer no way to ask whether a
// job is still open, so jobs are retired by age instead.
const AGE_EXPIRED_SOURCES = ['remotive', 'remoteok', 'themuse', 'adzuna', 'jooble', 'linkedin', 'naukri', 'indeed'];
const JOBICY_BATCH = 100;
const JOBICY_MAX_CHECKS = 1000;

/**
 * Jobicy's batch status API (https://jobicy.com/api/jobs/status, verified 2026-10-22)
 * reports "active" for open jobs; anything else means the posting is gone.
 */
async function closeEndedJobicyJobs() {
  const open = await Job.find({ source: 'jobicy', isActive: { $ne: false } })
    .sort({ lastSeenAt: 1 })
    .limit(JOBICY_MAX_CHECKS)
    .select('externalId')
    .lean();

  const ended = [];
  for (let i = 0; i < open.length; i += JOBICY_BATCH) {
    const ids = open.slice(i, i + JOBICY_BATCH).map((j) => j.externalId);
    const data = await fetchJson(`https://jobicy.com/api/jobs/status?ids=${ids.map(encodeURIComponent).join(',')}`);
    if (!Array.isArray(data?.jobs)) break; // unexpected shape: change nothing
    for (const job of data.jobs) {
      if (job?.status && job.status !== 'active') ended.push(String(job.id));
    }
  }
  if (ended.length === 0) return 0;
  const result = await Job.updateMany(
    { source: 'jobicy', externalId: { $in: ended }, isActive: { $ne: false } },
    { $set: { isActive: false } }
  );
  return result.modifiedCount;
}

/** Retire listings older than JOB_LISTING_MAX_AGE_DAYS from sources that can't report closures. */
async function closeAgedJobs() {
  const cutoff = new Date(Date.now() - env.JOB_LISTING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const result = await Job.updateMany(
    {
      source: { $in: AGE_EXPIRED_SOURCES },
      isActive: { $ne: false },
      $or: [{ postedAt: { $lt: cutoff } }, { postedAt: null, foundAt: { $lt: cutoff } }],
    },
    { $set: { isActive: false } }
  );
  return result.modifiedCount;
}

/**
 * Hide closed jobs from feeds. Each check fails independently; a failed check
 * never marks anything closed.
 */
export async function expireClosedJobs() {
  const summary = { jobicyClosed: 0, agedOut: 0, errors: [] };
  try {
    summary.jobicyClosed = await closeEndedJobicyJobs();
  } catch (err) {
    summary.errors.push(`jobicy-status: ${err.code || 'ERROR'}`);
  }
  try {
    summary.agedOut = await closeAgedJobs();
  } catch (err) {
    summary.errors.push(`age-expiry: ${err.code || 'ERROR'}`);
  }
  return summary;
}
