import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    titles: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
    locations: {
      type: [String],
      default: [],
    },
    seniority: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'staff', 'principal', 'lead', 'any'],
      default: 'senior',
    },
    salaryMin: {
      type: Number,
      default: null,
    },
    salaryMax: {
      type: Number,
      default: null,
    },
    fitThreshold: {
      type: Number,
      default: 65,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

profileSchema.index({ userId: 1, createdAt: -1 });

export const Profile = mongoose.model('Profile', profileSchema);

