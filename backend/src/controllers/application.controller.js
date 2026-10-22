import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { FollowUp } from '../models/FollowUp.js';
import { Match } from '../models/Match.js';

export async function listApplications(req, res) {
  const applications = await Application.find({ userId: req.user._id })
    .populate('jobId')
    .populate('matchId')
    .sort({ appliedAt: -1 })
    .lean();

  const appIds = applications.map((a) => a._id);
  const followUps = appIds.length > 0
    ? await FollowUp.find({ applicationId: { $in: appIds } }).lean()
    : [];

  const followUpsByApp = new Map();
  for (const f of followUps) {
    const key = f.applicationId.toString();
    if (!followUpsByApp.has(key)) followUpsByApp.set(key, []);
    followUpsByApp.get(key).push(f);
  }

  const formatted = applications.map((app) => {
    const appFollowUps = followUpsByApp.get(app._id.toString()) || [];
    return {
      id: app._id.toString(),
      _id: app._id,
      status: app.status,
      appliedAt: app.appliedAt,
      lastUpdateAt: app.lastUpdateAt,
      notes: app.notes,
      match: app.matchId ? {
        id: app.matchId._id?.toString() || app.matchId.toString(),
        fitScore: app.matchId.fitScore,
        listing: app.jobId ? {
          title: app.jobId.title,
          company: app.jobId.company,
          location: app.jobId.location,
          url: app.jobId.url,
          salaryText: app.jobId.salaryText,
        } : null,
      } : null,
      followUps: appFollowUps.map((f) => ({
        id: f._id.toString(),
        draftMessage: f.draftMessage,
        channel: f.channel,
        sentAt: f.sentAt,
        dismissedAt: f.dismissedAt,
      })),
    };
  });

  return res.json({ applications: formatted });
}

export async function createApplication(req, res) {
  const { matchId, jobId, notes, status } = req.body;

  let resolvedJobId = jobId;
  if (!resolvedJobId && matchId) {
    const match = await Match.findById(matchId);
    if (match) {
      resolvedJobId = match.jobId;
    }
  }

  if (!resolvedJobId) {
    return res.status(400).json({ error: 'Valid jobId or matchId is required' });
  }

  const app = await Application.create({
    userId: req.user._id,
    jobId: resolvedJobId,
    matchId: matchId || undefined,
    status: status || 'applied',
    notes: notes || '',
    appliedAt: new Date(),
    lastUpdateAt: new Date(),
  });

  return res.status(201).json({ success: true, application: app });
}

export async function updateApplicationStatus(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }

  const { status, notes } = req.body;

  const app = await Application.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    {
      $set: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        lastUpdateAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.json({ success: true, application: app });
}

export async function addFollowUp(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }

  const { draftMessage, channel } = req.body;

  const followUp = await FollowUp.create({
    userId: req.user._id,
    applicationId: req.params.id,
    draftMessage: draftMessage || 'Following up on my submitted application.',
    channel: channel || 'email',
  });

  return res.status(201).json({ success: true, followUp });
}

