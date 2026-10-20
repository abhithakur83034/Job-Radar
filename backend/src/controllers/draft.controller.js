import mongoose from 'mongoose';
import { TailoredDraft } from '../models/TailoredDraft.js';
import { Match } from '../models/Match.js';
import { Resume } from '../models/Resume.js';
import { Profile } from '../models/Profile.js';

export async function getDraftByMatch(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.matchId);
  if (!isObjectId) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  const draft = await TailoredDraft.findOne({
    matchId: req.params.matchId,
    userId: req.user._id,
  });

  return res.json({ draft });
}

export async function generateDraft(req, res) {
  const { matchId } = req.body;
  const isObjectId = mongoose.Types.ObjectId.isValid(matchId);
  if (!isObjectId) {
    return res.status(400).json({ error: 'Valid matchId is required' });
  }

  const match = await Match.findOne({ _id: matchId, userId: req.user._id }).populate('jobId');
  if (!match || !match.jobId) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const resume = await Resume.findOne({ userId: req.user._id }).sort({ uploadedAt: -1 });
  const profile = await Profile.findOne({ userId: req.user._id }).sort({ createdAt: -1 });

  const candidateName = req.user.name || 'Candidate';
  const jobTitle = match.jobId.title;
  const company = match.jobId.company;
  const skills = resume?.parsedData?.skills?.length
    ? resume.parsedData.skills.join(', ')
    : profile?.keywords?.join(', ') || 'React, Next.js, TypeScript';

  const tailoredResume = `# ${candidateName}
**Target Role:** ${jobTitle}
**Core Technologies:** ${skills}

## Executive Summary
Results-driven engineer specialized in building scalable, responsive web architectures and high-impact user experiences. Proven track record in rapid delivery and high performance aligned with ${company}'s technical standards.

## Key Technical Strengths
- **Frontend Architecture:** Deep mastery of modern web frameworks, component design systems, and responsive styling.
- **Full-Cycle Execution:** End-to-end implementation from technical specification to zero-downtime deployment.
- **Collaboration:** Partnering closely with product managers, UX designers, and cross-functional engineering teams.`;

  const coverLetter = `Dear ${company} Hiring Team,

I am writing to express my enthusiastic interest in the ${jobTitle} position at ${company}. Having followed ${company}'s engineering journey, I am energized by your commitment to technical excellence and user-centric product development.

With my core background in ${skills}, I have spent the last several years building maintainable, high-performance web applications that solve mission-critical problems. My experience directly mirrors the requirements outlined for the ${jobTitle} role, specifically regarding code reliability, rapid feature execution, and cross-team alignment.

I would welcome the opportunity to discuss how my technical experience and proactive problem-solving can contribute to ${company}'s immediate milestones. Thank you for your consideration.

Warm regards,
${candidateName}`;

  const changesMade = [
    `Emphasized core skills (${skills.slice(0, 40)}...) directly aligned with ${company}'s requirements`,
    `Framed executive summary for ${jobTitle} objectives`,
    `Constructed custom cover letter targeting ${company} hiring team`,
  ];

  let draft = await TailoredDraft.findOneAndUpdate(
    { matchId: match._id, userId: req.user._id },
    {
      $set: {
        resumeDraft: tailoredResume,
        coverLetterDraft: coverLetter,
        changesMade,
      },
    },
    { returnDocument: 'after', upsert: true }
  );

  return res.json({ success: true, draft });
}

export async function updateDraft(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId) {
    return res.status(400).json({ error: 'Invalid draft ID' });
  }

  const { resumeDraft, coverLetterDraft } = req.body;

  const draft = await TailoredDraft.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    {
      $set: {
        ...(resumeDraft ? { resumeDraft } : {}),
        ...(coverLetterDraft ? { coverLetterDraft } : {}),
      },
    },
    { returnDocument: 'after' }
  );

  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }

  return res.json({ success: true, draft });
}

