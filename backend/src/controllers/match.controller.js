import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { TailoredDraft } from '../models/TailoredDraft.js';
import { Application } from '../models/Application.js';
import { User } from '../models/User.js';

// The feed list only needs card fields; descriptions (up to 20KB each) come from GET /:id
const LIST_JOB_FIELDS = 'title company location salaryText source url remoteType postedAt foundAt createdAt isActive adminHidden';

export async function listMatches(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 500);
  let query = Match.find({ userId: req.user._id })
    .select('-missingRequirements -alertedAt')
    .populate('jobId', LIST_JOB_FIELDS)
    .populate('profileId', 'name fitThreshold')
    .sort({ fitScore: -1, createdAt: -1 });
  // Inactive (closed) jobs are filtered after populate, so over-fetch a little when limiting
  if (limit) query = query.limit(limit + 20);
  const [matches, me] = await Promise.all([
    query.lean(),
    User.findById(req.user._id).select('hiddenCompanies').lean(),
  ]);
  const hidden = new Set((me?.hiddenCompanies || []).map((c) => c.toLowerCase()));

  const formatted = matches
    // Job still exists and is open; score still meets the profile's threshold (saved matches always stay)
    .filter((m) => m.jobId && m.jobId.isActive !== false && !m.jobId.adminHidden)
    .filter((m) => m.saved || !m.profileId || m.fitScore >= (m.profileId.fitThreshold ?? 0))
    // "Not interested": dismissed matches and hidden companies (saved ones stay visible)
    .filter((m) => m.saved || (!m.dismissed && !hidden.has(String(m.jobId.company).toLowerCase())))
    .map((m) => ({
      id: m._id.toString(),
      _id: m._id,
      fitScore: m.fitScore,
      fitReason: m.fitReason,
      matchedSkills: m.matchedSkills,
      saved: m.saved,
      createdAt: m.createdAt,
      notifiedAt: m.notifiedAt,
      listing: {
        id: m.jobId._id.toString(),
        title: m.jobId.title,
        company: m.jobId.company,
        location: m.jobId.location,
        salaryText: m.jobId.salaryText,
        source: m.jobId.source,
        url: m.jobId.url,
        remoteType: m.jobId.remoteType || 'unknown',
        postedAt: m.jobId.postedAt || null,
        foundAt: m.jobId.foundAt || m.jobId.createdAt,
      },
      profile: m.profileId ? {
        id: m.profileId._id.toString(),
        name: m.profileId.name,
      } : null,
    }));

  return res.json({ matches: limit ? formatted.slice(0, limit) : formatted });
}

export async function getMatch(req, res) {
  // "top" = the user's best match (Drafts page default), saving a list round trip
  const isTop = req.params.id === 'top';
  if (!isTop && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const match = await Match.findOne(isTop ? { userId: req.user._id } : { _id: req.params.id, userId: req.user._id })
    .sort(isTop ? { fitScore: -1, createdAt: -1 } : undefined)
    .populate('jobId')
    .populate('profileId', 'name')
    .lean();

  if (!match || !match.jobId) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const [tailoredDraft, application] = await Promise.all([
    TailoredDraft.findOne({ matchId: match._id }).lean(),
    Application.findOne({ matchId: match._id }).lean(),
  ]);

  return res.json({
    match: {
      id: match._id.toString(),
      _id: match._id,
      fitScore: match.fitScore,
      fitReason: match.fitReason,
      matchedSkills: match.matchedSkills,
      missingRequirements: match.missingRequirements,
      saved: match.saved,
      createdAt: match.createdAt,
      listing: {
        id: match.jobId._id.toString(),
        title: match.jobId.title,
        company: match.jobId.company,
        location: match.jobId.location,
        salaryText: match.jobId.salaryText,
        source: match.jobId.source,
        url: match.jobId.url,
        description: match.jobId.description,
        foundAt: match.jobId.foundAt || match.jobId.createdAt,
      },
      tailoredDraft: tailoredDraft ? {
        id: tailoredDraft._id.toString(),
        resumeDraft: tailoredDraft.resumeDraft,
        coverLetterDraft: tailoredDraft.coverLetterDraft,
        changesMade: tailoredDraft.changesMade,
        updatedAt: tailoredDraft.updatedAt,
      } : null,
      application: application ? {
        id: application._id.toString(),
        status: application.status,
        appliedAt: application.appliedAt,
      } : null,
    },
  });
}

export async function toggleSaveMatch(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const match = await Match.findOne({ _id: req.params.id, userId: req.user._id });
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  match.saved = !match.saved;
  await match.save();

  return res.json({ success: true, saved: match.saved });
}

/** PATCH /matches/:id/dismiss — "Not interested" (or undo with { dismissed: false }). */
export async function dismissMatch(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Match not found' });
  }
  const match = await Match.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { dismissed: req.body.dismissed },
    { returnDocument: 'after' }
  ).select('dismissed');
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  return res.json({ dismissed: match.dismissed });
}

