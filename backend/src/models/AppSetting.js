import mongoose from 'mongoose';

/** Small key/value store for app-wide state (e.g. which scoring version has been applied). */
const appSettingSchema = new mongoose.Schema(
  {
    _id: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

export const AppSetting = mongoose.model('AppSetting', appSettingSchema);
