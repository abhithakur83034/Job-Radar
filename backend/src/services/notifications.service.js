import webpush from 'web-push';
import { env } from '../config/env.js';
import { Match } from '../models/Match.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { PushSubscription } from '../models/PushSubscription.js';

const MAX_LISTED = 3;

export function isPushConfigured() {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

let vapidReady = false;
function ensureVapid() {
  if (!vapidReady && isPushConfigured()) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidReady = true;
  }
  return vapidReady;
}

/** Send a push to every browser the user subscribed; prunes subscriptions the browser revoked. */
export async function sendPush(userId, payload) {
  if (!ensureVapid()) return { sent: 0, removed: 0 };
  const subscriptions = await PushSubscription.find({ userId }).lean();
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 24 * 60 * 60 });
        sent++;
      } catch (err) {
        // 404/410: the subscription expired or was revoked in the browser
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
          removed++;
        } else {
          console.error('[Push] Delivery failed:', err.statusCode || err.message);
        }
      }
    })
  );
  return { sent, removed };
}

/**
 * Notify users about strong matches for jobs that were newly found since `since`
 * (re-scoring old jobs never triggers alerts). One summary notification per user.
 */
export async function notifyNewMatches(since) {
  const candidates = await Match.find({
    createdAt: { $gte: since },
    alertedAt: null,
    dismissed: { $ne: true },
  })
    .populate('jobId', 'title company foundAt isActive adminHidden')
    .sort({ fitScore: -1 })
    .lean();

  const byUser = new Map();
  for (const m of candidates) {
    if (!m.jobId || m.jobId.isActive === false || m.jobId.adminHidden || !(m.jobId.foundAt >= since)) continue;
    if (!byUser.has(String(m.userId))) byUser.set(String(m.userId), []);
    byUser.get(String(m.userId)).push(m);
  }

  let notified = 0;
  for (const [userId, matches] of byUser) {
    const user = await User.findById(userId).select('notificationPrefs status').lean();
    if (!user || user.status === 'suspended') continue;
    const minScore = user.notificationPrefs?.minScore ?? 80;
    const strong = matches.filter((m) => m.fitScore >= minScore);
    if (strong.length === 0) continue;

    const title = `${strong.length} new strong match${strong.length === 1 ? '' : 'es'}`;
    const body = strong
      .slice(0, MAX_LISTED)
      .map((m) => `${m.jobId.title} · ${m.jobId.company} (${m.fitScore}%)`)
      .join('\n') + (strong.length > MAX_LISTED ? `\n+${strong.length - MAX_LISTED} more` : '');

    await Notification.create({ userId, type: 'new_matches', title, body, url: '/feed', matchIds: strong.map((m) => m._id) });
    await Match.updateMany({ _id: { $in: strong.map((m) => m._id) } }, { alertedAt: new Date() });
    if (user.notificationPrefs?.push !== false) await sendPush(userId, { title, body, url: '/feed' });
    notified++;
  }
  return { usersNotified: notified };
}
