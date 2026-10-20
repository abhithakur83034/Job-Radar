import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { saveFile } from '../utils/storage.js';

function imageFileName(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

function resumeFileName(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const safeBaseName = path
    .basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  return `${Date.now()}-${safeBaseName}${ext}`;
}

/**
 * Files are buffered in memory, validated by multer, then persisted to GridFS
 * (see utils/storage.js). req.file.buffer stays available for parsing.
 */
async function persistUpload(file, folder, buildName) {
  file.filename = buildName(file);
  await saveFile(`${folder}/${file.filename}`, file.buffer, file.mimetype);
}

// Allowed image formats
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) && ALLOWED_IMAGE_EXTS.has(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

// Allowed resume formats
const ALLOWED_RESUME_EXTS = new Set(['.pdf', '.doc', '.docx', '.txt']);

const resumeFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_RESUME_EXTS.has(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid résumé file type. Supported formats: PDF, DOC, DOCX, and TXT.');
    error.status = 400;
    cb(error, false);
  }
};

export const multerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 1,
  },
  fileFilter: imageFileFilter,
});

export const multerResumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max
    files: 1,
  },
  fileFilter: resumeFileFilter,
});

/**
 * Flexible middleware for image uploads (avatar, image, file).
 */
export function handleImageUpload(req, res, next) {
  const upload = multerImageUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image size exceeds the 5MB limit.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    const file =
      req.files?.avatar?.[0] || req.files?.image?.[0] || req.files?.file?.[0];

    if (!file) {
      return res.status(400).json({
        error: 'Please select an image file (under avatar, image, or file field).',
      });
    }

    req.file = file;
    persistUpload(file, 'images', imageFileName).then(() => next(), next);
  });
}

/**
 * Flexible middleware for resume document uploads (resume, file).
 */
export function handleResumeUpload(req, res, next) {
  const upload = multerResumeUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Résumé size exceeds the 20MB limit.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Résumé upload failed.' });
    }

    const file = req.files?.resume?.[0] || req.files?.file?.[0];

    if (!file) {
      return res.status(400).json({
        error: 'Please select a résumé file (under resume or file field).',
      });
    }

    req.file = file;
    persistUpload(file, 'resumes', resumeFileName).then(() => next(), next);
  });
}
