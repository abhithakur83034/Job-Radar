import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Match } from '../models/Match.js';
import { Job } from '../models/Job.js';
import { Notification } from '../models/Notification.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { isPushConfigured } from '../services/notifications.service.js';

// ---- "Not interested": hidden companies ----

export async function hideCompany(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { hiddenCompanies: req.body.company } },
    { returnDocument: 'after' }
  ).select('hiddenCompanies');
  return res.json({ hiddenCompanies: user.hiddenCompanies });
}

export async function unhideCompany(req, res) {
  const company = String(req.params.company || '').trim().toLowerCase();
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { hiddenCompanies: company } },
    { returnDocument: 'after' }
  ).select('hiddenCompanies');
  return res.json({ hiddenCompanies: user.hiddenCompanies });
}

/** POST /matches/:id/hide-company — hide the company of one of the user's matches. */
export async function hideCompanyOfMatch(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const match = await Match.findOne({ _id: req.params.id, userId: req.user._id }).select('jobId').lean();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const job = await Job.findById(match.jobId).select('company').lean();
  if (!job) return res.status(404).json({ error: 'Match not found' });

  const company = String(job.company).toLowerCase();
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { hiddenCompanies: company } },
    { returnDocument: 'after' }
  ).select('hiddenCompanies');
  return res.json({ company, hiddenCompanies: user.hiddenCompanies });
}

// ---- Notifications ----

export async function listNotifications(req, res) {
  const { page, limit } = req.query;
  const filter = { userId: req.user._id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  return res.json({
    items: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unread,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
  return res.json({ updated: result.modifiedCount });
}

export async function updateNotificationPrefs(req, res) {
  const $set = {};
  for (const [k, v] of Object.entries(req.body)) $set[`notificationPrefs.${k}`] = v;
  const user = await User.findByIdAndUpdate(req.user._id, { $set }, { returnDocument: 'after' }).select('notificationPrefs');
  return res.json({ notificationPrefs: user.notificationPrefs });
}

// ---- Browser push ----

/** Public VAPID key (safe to expose) and whether push is available on this server. */
export async function getPushConfig(req, res) {
  const subscriptions = await PushSubscription.countDocuments({ userId: req.user._id });
  return res.json({
    configured: isPushConfigured(),
    publicKey: isPushConfigured() ? env.VAPID_PUBLIC_KEY : null,
    subscriptions,
  });
}

export async function subscribePush(req, res) {
  if (!isPushConfigured()) return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  const { endpoint, keys } = req.body;
  // An endpoint belongs to one browser; re-subscribing moves it to the current user
  await PushSubscription.updateOne({ endpoint }, { userId: req.user._id, endpoint, keys }, { upsert: true });
  return res.status(201).json({ subscribed: true });
}

export async function unsubscribePush(req, res) {
  await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user._id });
  return res.json({ subscribed: false });
}
