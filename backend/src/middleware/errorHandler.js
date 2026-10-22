import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  // Joi validation errors (see middleware/validate.js)
  if (err.isJoi) {
    const issues = err.details.map((d) => ({ path: d.path, message: d.message.replace(/"/g, '') }));
    return res.status(400).json({
      error: issues.map((i) => i.message).join(', ') || 'Validation failed',
      issues,
    });
  }

  // MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyPattern || err.keyValue || {});
    const field = duplicateFields[0] || 'field';
    return res.status(409).json({
      error: `An account or record with that ${field} already exists.`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Invalid or expired session',
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid format for ${err.path}`,
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (statusCode >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  return res.status(statusCode).json({
    error: isClientError ? err.message : 'Internal server error',
  });
}

