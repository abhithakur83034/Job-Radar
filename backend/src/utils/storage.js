import mongoose from 'mongoose';
import { Readable } from 'stream';

/**
 * Uploaded files live in MongoDB GridFS (bucket "uploads") so they survive
 * restarts/redeploys on hosts with ephemeral disks (Render, Railway, etc.).
 * Files are keyed by their public path under /uploads, e.g. "images/123-abc.png".
 */
const BUCKET_NAME = 'uploads';

function getBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

export function saveFile(key, buffer, contentType) {
  return new Promise((resolve, reject) => {
    Readable.from(buffer)
      .pipe(getBucket().openUploadStream(key, { metadata: { contentType } }))
      .on('finish', resolve)
      .on('error', reject);
  });
}

export async function findFile(key) {
  const [file] = await getBucket()
    .find({ filename: key })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();
  return file || null;
}

export async function readFile(key) {
  const file = await findFile(key);
  if (!file) return null;

  const chunks = [];
  for await (const chunk of getBucket().openDownloadStream(file._id)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Express handler for GET /uploads/:folder/:filename.
 */
export async function serveStoredFile(req, res, next) {
  try {
    const file = await findFile(`${req.params.folder}/${req.params.filename}`);
    if (!file) return res.status(404).json({ error: 'File not found.' });

    res.setHeader('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    getBucket().openDownloadStream(file._id).on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}
