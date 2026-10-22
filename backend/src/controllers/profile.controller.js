import mongoose from 'mongoose';
import { Profile } from '../models/Profile.js';
import { rescoreInBackground } from '../utils/ingest.js';

// Request bodies are validated by Joi schemas in validators/profile.validators.js (see profile.routes.js)

export async function listProfiles(req, res) {
  const profiles = await Profile.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  return res.json({ profiles });
}

export async function createProfile(req, res) {
  const data = req.body;
  const profile = await Profile.create({
    ...data,
    userId: req.user._id,
  });
  rescoreInBackground(req.user._id, 'profile created');
  return res.status(201).json({ profile });
}

export async function getProfile(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const profile = await Profile.findOne(filter);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  return res.json({ profile });
}

export async function updateProfile(req, res) {
  const data = req.body;
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);

  if (isObjectId) {
    const profile = await Profile.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: data },
      { returnDocument: 'after' }
    );

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    rescoreInBackground(req.user._id, 'profile updated');
    return res.json({ profile });
  }

  // Fallback for non-ObjectId aliases (e.g. 'current' or transition IDs)
  let profile = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!profile) {
    profile = await Profile.create({
      ...data,
      name: data.name || data.titles?.[0] || 'My Search Profile',
      userId: req.user._id,
    });
  }

  rescoreInBackground(req.user._id, 'profile updated');
  return res.json({ profile });
}

export async function deleteProfile(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  if (!isObjectId && req.params.id !== 'latest' && req.params.id !== 'current') {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const profile = await Profile.findOneAndDelete(filter);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  return res.json({ success: true, message: 'Profile deleted' });
}
