import { User } from '../models/User.js';
import { safeUser } from './auth.controller.js';

export async function uploadAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  const avatarUrl = `/uploads/images/${req.file.filename}`;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { avatarUrl },
    { returnDocument: 'after' }
  );

  if (!updatedUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.status(200).json({
    success: true,
    avatarUrl,
    user: safeUser(updatedUser),
  });
}

export async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  const imageUrl = `/uploads/images/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    imageUrl,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
}
