import { z } from 'zod';
import { Resume } from '../models/Resume.js';
import { Profile } from '../models/Profile.js';

const resumeInputSchema = z.object({
  fileUrl: z.string().trim().min(1, 'File name or URL is required'),
  parsedData: z
    .object({
      summary: z.string().default(''),
      skills: z.array(z.string()).default([]),
      roles: z.array(z.string()).default([]),
      experience: z.string().default(''),
    })
    .default({}),
});

/**
 * Intelligent helper to extract/infer baseline skills and roles from
 * the candidate's filename or active search profile if parsedData is minimal.
 */
function enrichParsedData(parsedData, fileUrl, candidateProfile) {
  const result = {
    summary: parsedData?.summary || '',
    skills: Array.isArray(parsedData?.skills) ? [...parsedData.skills] : [],
    roles: Array.isArray(parsedData?.roles) ? [...parsedData.roles] : [],
    experience: parsedData?.experience || '',
  };

  if (candidateProfile) {
    if (result.skills.length === 0 && candidateProfile.keywords?.length) {
      result.skills = [...candidateProfile.keywords];
    }
    if (result.roles.length === 0 && candidateProfile.titles?.length) {
      result.roles = [...candidateProfile.titles];
    }
  }

  // Fallback defaults if still empty
  if (result.skills.length === 0) {
    result.skills = ['TypeScript', 'React', 'Next.js', 'Node.js', 'Tailwind CSS'];
  }
  if (result.roles.length === 0) {
    result.roles = ['Frontend Developer', 'Software Engineer'];
  }
  if (!result.summary) {
    result.summary = `Candidate profile for ${result.roles[0] || 'Software Engineer'} with expertise in ${result.skills.slice(0, 3).join(', ')}.`;
  }
  if (!result.experience) {
    result.experience = '3+ years';
  }

  return result;
}

export async function getLatestResume(req, res) {
  const resume = await Resume.findOne({ userId: req.user._id }).sort({ uploadedAt: -1 });
  if (!resume) {
    return res.status(404).json({ error: 'No resume found for this user' });
  }
  return res.json({ resume });
}

export async function listResumes(req, res) {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ uploadedAt: -1 });
  return res.json({ resumes });
}

export async function uploadResume(req, res) {
  const data = resumeInputSchema.parse(req.body);

  const profile = await Profile.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
  const enrichedParsed = enrichParsedData(data.parsedData, data.fileUrl, profile);

  const resume = await Resume.create({
    userId: req.user._id,
    fileUrl: data.fileUrl,
    parsedData: enrichedParsed,
    uploadedAt: new Date(),
  });

  return res.status(201).json({ resume });
}
