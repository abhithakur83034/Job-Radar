import mongoose from 'mongoose';
import { z } from 'zod';
import { Profile } from '../models/Profile.js';

const profileInputSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required').max(120),
  titles: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  seniority: z.enum(['entry', 'mid', 'senior', 'staff', 'principal', 'lead', 'any']).default('senior'),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  fitThreshold: z.number().min(0).max(100).default(65),
});

export async function listProfiles(req, res) {
  const profiles = await Profile.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return res.json({ profiles });
}

export async function createProfile(req, res) {
  const data = profileInputSchema.parse(req.body);
  const profile = await Profile.create({
    ...data,
    userId: req.user._id,
  });
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
  const data = profileInputSchema.partial().parse(req.body);
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

  return res.json({ profile });
}

export async function deleteProfile(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = isObjectId
    ? { _id: req.params.id, userId: req.user._id }
    : { userId: req.user._id };

  const profile = await Profile.findOneAndDelete(filter);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  return res.json({ success: true, message: 'Profile deleted' });
}
