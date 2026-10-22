import Joi from 'joi';

export const createResumeSchema = Joi.object({
  fileUrl: Joi.string().trim().min(1).max(500).required().label('File name or URL'),
  fileName: Joi.string().trim().max(255),
  parsedData: Joi.object({
    summary: Joi.string().allow('').max(5000).default(''),
    skills: Joi.array().items(Joi.string().trim().max(100)).max(200).default([]),
    roles: Joi.array().items(Joi.string().trim().max(150)).max(50).default([]),
    experience: Joi.string().allow('').max(200).default(''),
  }).default({ summary: '', skills: [], roles: [], experience: '' }),
});
