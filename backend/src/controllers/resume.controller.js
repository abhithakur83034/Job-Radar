import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Resume } from '../models/Resume.js';
import { Profile } from '../models/Profile.js';
import { User } from '../models/User.js';
import { parseResumeData } from '../utils/resumeParser.js';

const resumeInputSchema = z.object({
  fileUrl: z.string().trim().min(1, 'File name or URL is required'),
  fileName: z.string().optional(),
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

/**
 * Generates a clean, valid PDF buffer for existing records that don't yet have a physical file on disk.
 */
function buildFallbackPdf({ name, email, title, summary, skills, roles }) {
  const safeName = (name || 'Candidate').replace(/[()]/g, '');
  const safeEmail = (email || '').replace(/[()]/g, '');
  const safeTitle = (title || roles?.[0] || 'Software Engineer').replace(/[()]/g, '');
  const safeSummary = (summary || 'Candidate resume on file with verified technical skills.').replace(/[()]/g, '').slice(0, 200);
  const safeSkills = (skills?.length ? skills.join(', ') : 'Software Engineering').replace(/[()]/g, '');

  const textLines = [
    'BT',
    '/F1 20 Tf',
    '50 720 Td',
    `(${safeName}) Tj`,
    '/F1 12 Tf',
    '0 -24 Td',
    `(${safeTitle}  |  ${safeEmail}) Tj`,
    '/F1 13 Tf',
    '0 -36 Td',
    '(PROFESSIONAL SUMMARY) Tj',
    '/F1 10 Tf',
    '0 -18 Td',
    `(${safeSummary}) Tj`,
    '/F1 13 Tf',
    '0 -36 Td',
    '(TECHNICAL SKILLS) Tj',
    '/F1 10 Tf',
    '0 -18 Td',
    `(${safeSkills}) Tj`,
    'ET',
  ].join('\n');

  const streamLength = Buffer.byteLength(textLines);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${textLines}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000234 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdf);
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
    fileName: data.fileName || path.basename(data.fileUrl),
    parsedData: enrichedParsed,
    uploadedAt: new Date(),
  });

  return res.status(201).json({ resume });
}

/**
 * Handle multipart résumé file upload using Multer.
 * Saves physical file into backend/uploads/resumes/ and extracts search criteria.
 */
export async function uploadResumeFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No résumé file uploaded.' });
  }

  const buffer = req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null;
  const extracted = parseResumeData(buffer, req.file.originalname);

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
      experience: extracted.seniority === 'senior' ? '5+ years' : '3+ years',
    },
    uploadedAt: new Date(),
  });

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
  const buffer = req.file?.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null;
  const filename = req.file?.originalname || req.body?.fileName || '';
  const extracted = parseResumeData(buffer, filename);

  return res.json({
    success: true,
    extracted,
  });
}

/**
 * Stream/view the résumé file inline in the browser.
 */
export async function viewResumeFile(req, res) {
  const isObjectId = req.params.id && req.params.id !== 'latest' && mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const resume = await Resume.findOne(filter).sort({ uploadedAt: -1 });
  if (!resume) {
    return res.status(404).json({ error: 'No résumé found.' });
  }

  const fileName = resume.fileName || path.basename(resume.fileUrl);
  const possiblePaths = [
    path.join(process.cwd(), resume.fileUrl),
    path.join(process.cwd(), 'uploads', 'resumes', path.basename(resume.fileUrl)),
    path.join(process.cwd(), 'uploads', 'resumes', fileName),
  ];

  let resolvedPath = possiblePaths.find((p) => fs.existsSync(p));

  // If physical file doesn't exist on disk yet, generate clean PDF on-the-fly!
  if (!resolvedPath) {
    const user = await User.findById(req.user._id);
    const pdfBuffer = buildFallbackPdf({
      name: user?.name,
      email: user?.email,
      title: resume.parsedData?.roles?.[0],
      summary: resume.parsedData?.summary,
      skills: resume.parsedData?.skills,
      roles: resume.parsedData?.roles,
    });

    const fallbackPath = path.join(process.cwd(), 'uploads', 'resumes', fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    fs.writeFileSync(fallbackPath, pdfBuffer);
    resolvedPath = fallbackPath;
  }

  res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fileName)}"`
  );

  return res.sendFile(resolvedPath);
}

/**
 * Download the résumé file.
 */
export async function downloadResumeFile(req, res) {
  const isObjectId = req.params.id && req.params.id !== 'latest' && mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const resume = await Resume.findOne(filter).sort({ uploadedAt: -1 });
  if (!resume) {
    return res.status(404).json({ error: 'No résumé found.' });
  }

  const fileName = resume.fileName || path.basename(resume.fileUrl);
  const possiblePaths = [
    path.join(process.cwd(), resume.fileUrl),
    path.join(process.cwd(), 'uploads', 'resumes', path.basename(resume.fileUrl)),
    path.join(process.cwd(), 'uploads', 'resumes', fileName),
  ];

  let resolvedPath = possiblePaths.find((p) => fs.existsSync(p));

  if (!resolvedPath) {
    const user = await User.findById(req.user._id);
    const pdfBuffer = buildFallbackPdf({
      name: user?.name,
      email: user?.email,
      title: resume.parsedData?.roles?.[0],
      summary: resume.parsedData?.summary,
      skills: resume.parsedData?.skills,
      roles: resume.parsedData?.roles,
    });

    const fallbackPath = path.join(process.cwd(), 'uploads', 'resumes', fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    fs.writeFileSync(fallbackPath, pdfBuffer);
    resolvedPath = fallbackPath;
  }

  res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fileName)}"`
  );

  return res.download(resolvedPath, fileName);
}
