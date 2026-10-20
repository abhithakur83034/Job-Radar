import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { TailoredDraft } from '../models/TailoredDraft.js';
import { Application } from '../models/Application.js';

export async function listMatches(req, res) {
  const matches = await Match.find({ userId: req.user._id })
    .populate('jobId')
    .populate('profileId')
    .sort({ fitScore: -1, createdAt: -1 });

  const formatted = matches
    .filter((m) => m.jobId) // ensure job still exists
    .map((m) => ({
      id: m._id.toString(),
      _id: m._id,
      fitScore: m.fitScore,
      fitReason: m.fitReason,
      matchedSkills: m.matchedSkills,
      missingRequirements: m.missingRequirements,
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
        description: m.jobId.description,
        foundAt: m.jobId.foundAt || m.jobId.createdAt,
      },
      profile: m.profileId ? {
        id: m.profileId._id.toString(),
        name: m.profileId.name,
      } : null,
    }));

  return res.json({ matches: formatted });
}

export async function getMatch(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const match = await Match.findOne({ _id: req.params.id, userId: req.user._id })
    .populate('jobId')
    .populate('profileId');

  if (!match || !match.jobId) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const tailoredDraft = await TailoredDraft.findOne({ matchId: match._id });
  const application = await Application.findOne({ matchId: match._id });

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

