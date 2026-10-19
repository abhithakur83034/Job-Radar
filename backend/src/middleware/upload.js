import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const IMAGES_DIR = path.join(UPLOAD_DIR, 'images');
const RESUMES_DIR = path.join(UPLOAD_DIR, 'resumes');

// Ensure upload directories exist
for (const dir of [UPLOAD_DIR, IMAGES_DIR, RESUMES_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Storage engine for images
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

// Storage engine for resumes
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, RESUMES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const unique = `${Date.now()}-${safeBaseName}${ext}`;
    cb(null, unique);
  },
});

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
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 1,
  },
  fileFilter: imageFileFilter,
});

export const multerResumeUpload = multer({
  storage: resumeStorage,
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
    next();
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
    next();
  });
}
