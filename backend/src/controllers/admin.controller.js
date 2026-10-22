import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Match } from '../models/Match.js';
import { Profile } from '../models/Profile.js';
import { Resume } from '../models/Resume.js';
import { Application } from '../models/Application.js';
import { Notification } from '../models/Notification.js';
import { GmailConnection } from '../models/GmailConnection.js';
import { AuditLog } from '../models/AuditLog.js';
import { JobRefreshRun } from '../models/JobRefreshRun.js';
import { getSourceStatuses, runJobRefresh } from '../services/jobs/jobRefresh.service.js';
import { getSettingsDetail, updateSettings, resetSettings } from '../config/runtimeSettings.js';
import { isPushConfigured } from '../services/notifications.service.js';
import { isGmailConfigured } from './gmail.controller.js';
import { audit } from '../utils/audit.js';
import { createResetToken } from '../services/passwordReset.service.js';

const DAY = 24 * 60 * 60 * 1000;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** +919876543210 -> +91•••••43210: enough to recognise, not to copy. */
function maskMobile(mobile) {
  if (!mobile) return null;
  return mobile.length > 7 ? `${mobile.slice(0, 3)}•••••${mobile.slice(-5)}` : '•••••';
}

function userRow(u) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    username: u.username || null,
    mobile: maskMobile(u.mobile),
    role: u.role,
    status: u.status || 'active',
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt || null,
  };
}

const ACTIVE_JOB = { isActive: { $ne: false }, adminHidden: { $ne: true } };

// ---------- Overview ----------

/**
 * Metric definitions:
 * - active users: signed-in activity in the last 7 days (lastActiveAt)
 * - open jobs: not closed by a source refresh/expiry and not hidden by an admin
 * - new: created/found in the last 24 hours (users: 7 days)
 */
export async function getOverview(_req, res) {
  const now = Date.now();
  const [
    totalUsers, activeUsers, newUsers, suspendedUsers, admins,
    totalJobs, openJobs, hiddenJobs, newJobs, openBySource,
    totalMatches, savedMatches, newMatches, applications, notificationsWeek,
    sources, lastRun, recentProblems,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActiveAt: { $gte: new Date(now - 7 * DAY) } }),
    User.countDocuments({ createdAt: { $gte: new Date(now - 7 * DAY) } }),
    User.countDocuments({ status: 'suspended' }),
    User.countDocuments({ role: 'admin' }),
    Job.estimatedDocumentCount(),
    Job.countDocuments(ACTIVE_JOB),
    Job.countDocuments({ adminHidden: true }),
    Job.countDocuments({ foundAt: { $gte: new Date(now - DAY) } }),
    Job.aggregate([{ $match: ACTIVE_JOB }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Match.estimatedDocumentCount(),
    Match.countDocuments({ saved: true }),
    Match.countDocuments({ createdAt: { $gte: new Date(now - DAY) } }),
    Application.countDocuments(),
    Notification.countDocuments({ createdAt: { $gte: new Date(now - 7 * DAY) } }),
    getSourceStatuses(),
    JobRefreshRun.findOne().sort({ startedAt: -1 }).lean(),
    JobRefreshRun.find({ status: { $in: ['failed', 'partial'] } }).sort({ startedAt: -1 }).limit(5).lean(),
  ]);

  return res.json({
    users: { total: totalUsers, active7d: activeUsers, new7d: newUsers, suspended: suspendedUsers, admins },
    jobs: {
      total: totalJobs,
      open: openJobs,
      closed: Math.max(0, totalJobs - openJobs - hiddenJobs),
      hidden: hiddenJobs,
      new24h: newJobs,
      openBySource: openBySource.map((s) => ({ source: s._id, count: s.count })),
    },
    matches: { total: totalMatches, saved: savedMatches, new24h: newMatches },
    applications: { total: applications },
    notifications: { sent7d: notificationsWeek },
    sources: sources.map(({ id, displayName, configured, lastStatus, lastSuccessAt, lastFetched, lastError }) => ({
      id, displayName, configured, lastStatus, lastSuccessAt, lastFetched, lastError,
    })),
    lastRun: lastRun ? runRow(lastRun) : null,
    recentProblems: recentProblems.map(runRow),
    features: { gmailImport: isGmailConfigured(), pushNotifications: isPushConfigured() },
  });
}

// ---------- Users ----------

export async function listUsers(req, res) {
  const { page, limit, search, role, status, registeredFrom, registeredTo } = req.query;
  const filter = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { username: pattern }];
  }
  if (role) filter.role = role;
  if (status === 'suspended') filter.status = 'suspended';
  if (status === 'active') filter.status = { $ne: 'suspended' };
  if (registeredFrom || registeredTo) {
    filter.createdAt = {};
    if (registeredFrom) filter.createdAt.$gte = registeredFrom;
    if (registeredTo) filter.createdAt.$lte = registeredTo;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email username mobile role status createdAt lastActiveAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return res.json({ items: users.map(userRow), pagination: pagination(page, limit, total) });
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id)
    .select('name email username mobile role status createdAt lastActiveAt scanCompanies hiddenCompanies')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

  const [profiles, matches, saved, applications, hasResume, gmail] = await Promise.all([
    Profile.find({ userId: user._id }).select('name titles locations seniority fitThreshold').lean(),
    Match.countDocuments({ userId: user._id }),
    Match.countDocuments({ userId: user._id, saved: true }),
    Application.countDocuments({ userId: user._id }),
    Resume.exists({ userId: user._id }),
    GmailConnection.exists({ userId: user._id }),
  ]);

  // Résumé files/contents, password hashes and tokens are never returned
  return res.json({
    user: {
      ...userRow(user),
      companiesFollowed: user.scanCompanies?.length ?? 0,
      hiddenCompanies: user.hiddenCompanies?.length ?? 0,
      profiles: profiles.map((p) => ({
        name: p.name, titles: p.titles, locations: p.locations, seniority: p.seniority, fitThreshold: p.fitThreshold,
      })),
      counts: { matches, saved, applications },
      hasResume: Boolean(hasResume),
      gmailConnected: Boolean(gmail),
    },
  });
}

/** True if `userId` is the only active admin left. */
async function isLastActiveAdmin(userId) {
  const others = await User.countDocuments({ role: 'admin', status: { $ne: 'suspended' }, _id: { $ne: userId } });
  return others === 0;
}

export async function updateUserStatus(req, res) {
  const { status, reason } = req.body;
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ error: "You can't change your own account status.", code: 'SELF_CHANGE' });
  }
  const target = await User.findById(req.params.id).select('email username role status');
  if (!target) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

  if (status === 'suspended' && target.role === 'admin' && (await isLastActiveAdmin(target._id))) {
    return res.status(409).json({ error: "Can't suspend the last active admin.", code: 'LAST_ADMIN' });
  }
  const from = target.status || 'active';
  target.status = status;
  await target.save();
  await audit(req.user, {
    action: 'user.status.update', targetType: 'user', targetId: target._id,
    targetLabel: target.username || target.email, reason, changes: { from, to: status },
  });
  return res.json({ user: { id: String(target._id), status } });
}

export async function updateUserRole(req, res) {
  const { role, reason } = req.body;
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ error: "You can't change your own role.", code: 'SELF_CHANGE' });
  }
  const target = await User.findById(req.params.id).select('email username role status');
  if (!target) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

  if (role === 'user' && target.role === 'admin' && (await isLastActiveAdmin(target._id))) {
    return res.status(409).json({ error: "Can't remove the last active admin.", code: 'LAST_ADMIN' });
  }
  const from = target.role;
  target.role = role;
  await target.save();
  await audit(req.user, {
    action: 'user.role.update', targetType: 'user', targetId: target._id,
    targetLabel: target.username || target.email, reason, changes: { from, to: role },
  });
  return res.json({ user: { id: String(target._id), role } });
}

/** Creates a one-time reset link to share with the user (e.g. when email isn't set up). */
export async function createUserResetLink(req, res) {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ error: 'Use "Forgot password" for your own account.', code: 'SELF_CHANGE' });
  }
  const target = await User.findById(req.params.id).select('email username');
  if (!target) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  const { url, expiresInMinutes } = await createResetToken(target._id, 'admin');
  // The link itself is never written to the audit log
  await audit(req.user, {
    action: 'user.password-reset-link', targetType: 'user', targetId: target._id,
    targetLabel: target.username || target.email, reason: req.body.reason,
  });
  return res.json({ url, expiresInMinutes });
}

// ---------- Jobs ----------

function jobStatus(j) {
  if (j.adminHidden) return 'hidden';
  return j.isActive === false ? 'closed' : 'open';
}

export async function listJobs(req, res) {
  const { page, limit, search, source, company, status, foundFrom, foundTo } = req.query;
  const filter = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { company: pattern }, { location: pattern }];
  }
  if (source) filter.source = source;
  if (company) filter.company = new RegExp(`^${escapeRegex(company)}$`, 'i');
  if (status === 'open') Object.assign(filter, ACTIVE_JOB);
  if (status === 'closed') Object.assign(filter, { isActive: false, adminHidden: { $ne: true } });
  if (status === 'hidden') filter.adminHidden = true;
  if (foundFrom || foundTo) {
    filter.foundAt = {};
    if (foundFrom) filter.foundAt.$gte = foundFrom;
    if (foundTo) filter.foundAt.$lte = foundTo;
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select('title company location source isActive adminHidden foundAt lastSeenAt postedAt')
      .sort({ foundAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);
  return res.json({
    items: jobs.map((j) => ({
      id: String(j._id), title: j.title, company: j.company, location: j.location, source: j.source,
      status: jobStatus(j), foundAt: j.foundAt, lastSeenAt: j.lastSeenAt, postedAt: j.postedAt,
    })),
    pagination: pagination(page, limit, total),
  });
}

export async function getJob(req, res) {
  const job = await Job.findById(req.params.id).populate('moderatedBy', 'username email').lean();
  if (!job) return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
  const matches = await Match.countDocuments({ jobId: job._id });
  return res.json({
    job: {
      id: String(job._id),
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      externalId: job.externalId,
      status: jobStatus(job),
      // Plain text (HTML is stripped at ingestion), safe to render as text
      description: job.description,
      salaryText: job.salaryText,
      remoteType: job.remoteType,
      employmentType: job.employmentType,
      url: job.url,
      applyUrl: job.applyUrl,
      postedAt: job.postedAt,
      foundAt: job.foundAt,
      lastSeenAt: job.lastSeenAt,
      moderation: job.moderatedAt
        ? {
            reason: job.moderationReason,
            by: job.moderatedBy?.username || job.moderatedBy?.email || null,
            at: job.moderatedAt,
          }
        : null,
      matches,
    },
  });
}

export async function updateJobStatus(req, res) {
  const { status, reason } = req.body;
  const job = await Job.findById(req.params.id).select('title company adminHidden isActive');
  if (!job) return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });

  const from = jobStatus(job);
  job.adminHidden = status === 'hidden';
  if (status === 'visible') job.isActive = true;
  job.moderationReason = reason;
  job.moderatedBy = req.user._id;
  job.moderatedAt = new Date();
  await job.save();
  await audit(req.user, {
    action: status === 'hidden' ? 'job.hide' : 'job.restore', targetType: 'job', targetId: job._id,
    targetLabel: `${job.title} · ${job.company}`, reason, changes: { from, to: jobStatus(job) },
  });
  return res.json({ job: { id: String(job._id), status: jobStatus(job) } });
}

// ---------- Job sources & refresh runs ----------

const SETUP_GUIDE = {
  adzuna: 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY in the backend environment (free key at developer.adzuna.com).',
  jooble: 'Set JOOBLE_API_KEY in the backend environment (request a key at in.jooble.org/api/about).',
  themuse: 'Optional: set THE_MUSE_API_KEY to raise the rate limit.',
};

function runRow(r) {
  return {
    id: String(r._id),
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationMs: r.durationMs,
    providers: r.providers,
    newListings: r.newListings,
    newMatches: r.newMatches,
    closedJobs: r.closedJobs,
    error: r.error,
  };
}

export async function listSources(_req, res) {
  const sources = await getSourceStatuses();
  return res.json({
    sources: sources.map((s) => ({ ...s, setup: !s.configured || s.id === 'themuse' ? SETUP_GUIDE[s.id] ?? null : null })),
  });
}

export async function listRuns(req, res) {
  const { page, limit } = req.query;
  const [runs, total] = await Promise.all([
    JobRefreshRun.find().sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    JobRefreshRun.countDocuments(),
  ]);
  return res.json({ items: runs.map(runRow), pagination: pagination(page, limit, total) });
}

export async function triggerRefresh(req, res) {
  const result = await runJobRefresh({ trigger: 'admin', triggeredBy: req.user._id });
  if (result.status === 'locked') {
    await audit(req.user, { action: 'job-refresh.trigger', targetType: 'job-refresh', outcome: 'failure', reason: req.body?.reason || null, changes: { result: 'already running' } });
    return res.status(409).json({ error: result.message, code: 'REFRESH_RUNNING' });
  }
  await audit(req.user, {
    action: 'job-refresh.trigger', targetType: 'job-refresh', targetId: result.runId, reason: req.body?.reason || null,
    changes: { outcome: result.outcome, newListings: result.newListings, newMatches: result.newMatches },
  });
  return res.json({
    run: { id: result.runId, outcome: result.outcome, durationMs: result.durationMs, newListings: result.newListings, newMatches: result.newMatches },
    providers: result.providers,
  });
}

// ---------- Audit log ----------

export async function listAuditLogs(req, res) {
  const { page, limit, action, targetType } = req.query;
  const filter = {};
  if (action) filter.action = new RegExp(`^${escapeRegex(action)}`);
  if (targetType) filter.targetType = targetType;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return res.json({
    items: items.map((a) => ({
      id: String(a._id), actor: a.actorLabel, action: a.action, targetType: a.targetType, targetId: a.targetId,
      targetLabel: a.targetLabel, reason: a.reason, outcome: a.outcome, changes: a.changes, createdAt: a.createdAt,
    })),
    pagination: pagination(page, limit, total),
  });
}

// ---------- Settings ----------

export async function getSettings(_req, res) {
  return res.json(getSettingsDetail());
}

export async function patchSettings(req, res) {
  const { before, after } = await updateSettings(req.body);
  const changed = Object.fromEntries(
    Object.keys(req.body).filter((k) => before[k] !== after[k]).map((k) => [k, { from: before[k], to: after[k] }])
  );
  await audit(req.user, { action: 'settings.update', targetType: 'settings', targetId: 'jobRefreshSettings', changes: changed });
  return res.json(getSettingsDetail());
}

export async function resetSettingsToDefaults(req, res) {
  const { before, after } = await resetSettings();
  await audit(req.user, { action: 'settings.reset', targetType: 'settings', targetId: 'jobRefreshSettings', changes: { from: before, to: after } });
  return res.json(getSettingsDetail());
}
