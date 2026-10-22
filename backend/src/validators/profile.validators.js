import Joi from 'joi';

const SENIORITY = ['entry', 'mid', 'senior', 'staff', 'principal', 'lead', 'any'];
const terms = Joi.array().items(Joi.string().trim().max(100)).max(50);

const fields = {
  name: Joi.string().trim().min(1).max(120).label('Profile name'),
  titles: terms,
  keywords: terms,
  locations: terms,
  seniority: Joi.string().valid(...SENIORITY),
  salaryMin: Joi.number().min(0).allow(null),
  salaryMax: Joi.number().min(0).allow(null),
  fitThreshold: Joi.number().min(0).max(100),
};

export const createProfileSchema = Joi.object({
  ...fields,
  name: fields.name.required(),
  titles: fields.titles.default([]),
  keywords: fields.keywords.default([]),
  locations: fields.locations.default([]),
  seniority: fields.seniority.default('senior'),
  fitThreshold: fields.fitThreshold.default(65),
});

// PATCH: no defaults, so fields that aren't sent are left unchanged
export const updateProfileSchema = Joi.object(fields).min(1).messages({ 'object.min': 'Nothing to update' });
