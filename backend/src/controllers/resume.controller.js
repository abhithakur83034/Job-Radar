import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Resume } from '../models/Resume.js';
import { Profile } from '../models/Profile.js';
import { parseResumeData } from '../utils/resumeParser.js';
import { readFile } from '../utils/storage.js';
import { rescoreInBackground } from '../utils/ingest.js';

// POST / body is validated by validators/resume.validators.js (see resume.routes.js)

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

  // Nothing is invented: fields with no real data stay empty

  return result;
}


export async function getLatestResume(req, res) {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ uploadedAt: -1 }).lean();
  if (!resumes || resumes.length === 0) {
    return res.status(404).json({ error: 'No resume found for this user' });
  }
  const resume = resumes.find((r) => findPhysicalResumeFile(r)) || resumes[0];
  return res.json({ resume });
}

export async function listResumes(req, res) {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ uploadedAt: -1 }).lean();
  return res.json({ resumes });
}

export async function uploadResume(req, res) {
  const data = req.body;

  const profile = await Profile.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
  const enrichedParsed = enrichParsedData(data.parsedData, data.fileUrl, profile);

  const resume = await Resume.create({
    userId: req.user._id,
    fileUrl: data.fileUrl,
    fileName: data.fileName || path.basename(data.fileUrl),
    parsedData: enrichedParsed,
    uploadedAt: new Date(),
  });

  rescoreInBackground(req.user._id, 'résumé added');
  return res.status(201).json({ resume });
}

/**
 * Handle multipart résumé file upload using Multer.
 * The file is persisted to GridFS by the upload middleware; this extracts search criteria.
 */
export async function uploadResumeFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No résumé file uploaded.' });
  }

  const buffer = req.file.buffer || null;
  const extracted = await parseResumeData(buffer, req.file.originalname);

  const fileUrl = `/uploads/resumes/${req.file.filename}`;

  const resume = await Resume.create({
    userId: req.user._id,
    fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    parsedData: {
      summary: extracted.summary,
      skills: extracted.keywords,
      roles: extracted.titles,
      experience: extracted.yearsExperience !== null ? `${extracted.yearsExperience} years` : '',
    },
    uploadedAt: new Date(),
  });

  rescoreInBackground(req.user._id, 'résumé uploaded');
  return res.status(201).json({
    success: true,
    resume,
    extracted,
  });
}

/**
 * Parse an uploaded résumé or file name and return extracted criteria for onboarding prefill.
 */
export async function parseResume(req, res) {
  const buffer = req.file?.buffer || null;
  const filename = req.file?.originalname || req.body?.fileName || '';
  const extracted = await parseResumeData(buffer, filename);

  return res.json({
    success: true,
    extracted,
  });
}

/**
 * Legacy lookup for résumé files written to local disk before GridFS storage.
 */
function findPhysicalResumeFile(resume) {
  const fileName = resume.fileName || path.basename(resume.fileUrl);
  const possiblePaths = [
    path.join(process.cwd(), resume.fileUrl.startsWith('/') ? resume.fileUrl.slice(1) : resume.fileUrl),
    path.join(process.cwd(), 'uploads', 'resumes', path.basename(resume.fileUrl)),
    path.join(process.cwd(), 'uploads', 'resumes', fileName),
  ];

  let resolved = possiblePaths.find((p) => fs.existsSync(p));
  if (resolved) return resolved;

  // Search uploads/resumes for any timestamp-prefixed file matching the original filename
  const resumesDir = path.join(process.cwd(), 'uploads', 'resumes');
  if (fs.existsSync(resumesDir)) {
    const files = fs.readdirSync(resumesDir);
    const match = files
      .filter((f) => f.endsWith(`-${fileName}`) || f === fileName)
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[0], 10) || 0;
        const timeB = parseInt(b.split('-')[0], 10) || 0;
        return timeB - timeA;
      })[0];
    if (match) {
      return path.join(resumesDir, match);
    }
  }

  return null;
}

/**
 * Load the stored résumé bytes: GridFS first, then legacy local disk.
 */
async function loadResumeFile(resume) {
  if (!resume) return null;
  const stored = await readFile(`resumes/${path.basename(resume.fileUrl)}`);
  if (stored) return stored;

  const diskPath = findPhysicalResumeFile(resume);
  return diskPath ? fs.readFileSync(diskPath) : null;
}

/**
 * Resolve the user's résumé (by id or newest with a stored file) and its bytes,
 * generating a clean PDF on-the-fly when no file was ever stored.
 */
async function resolveResumeForUser(req) {
  const isObjectId = req.params.id && req.params.id !== 'latest' && mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const resumes = await Resume.find(filter).sort({ uploadedAt: -1 });
  if (!resumes || resumes.length === 0) return null;

  // Prefer the newest resume that has a stored file
  for (const resume of resumes) {
    const buffer = await loadResumeFile(resume);
    if (buffer) {
      return { resume, buffer, fileName: resume.fileName || path.basename(resume.fileUrl), mimeType: resume.mimeType || 'application/pdf' };
    }
  }

  // No stored file: report it rather than generating a stand-in document
  return null;
}

/**
 * Stream/view the résumé file inline in the browser.
 */
export async function viewResumeFile(req, res) {
  const found = await resolveResumeForUser(req);
  if (!found) {
    return res.status(404).json({ error: 'No résumé file found. Please upload your résumé again.' });
  }

  res.setHeader('Content-Type', found.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(found.fileName)}"`);
  return res.send(found.buffer);
}

/**
 * Download the résumé file.
 */
export async function downloadResumeFile(req, res) {
  const found = await resolveResumeForUser(req);
  if (!found) {
    return res.status(404).json({ error: 'No résumé found.' });
  }

  res.setHeader('Content-Type', found.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(found.fileName)}"`);
  return res.send(found.buffer);
}
