import mongoose, { Document, Schema } from 'mongoose';

export interface IZaloConfig extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  cookie: string | any[] | object; // Hỗ trợ cả string, array và object
  imei: string;
  userAgent: string;
  avatar?: string; // Thêm field avatar
  display_name?: string; // Thêm field display_name
  proxy?: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const zaloConfigSchema = new Schema<IZaloConfig>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  cookie: {
    type: Schema.Types.Mixed, // Hỗ trợ mọi type: string, array, object
    required: true
  },
  imei: {
    type: String,
    required: true,
    trim: true
  },
  userAgent: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    trim: true
  },
  display_name: {
    type: String,
    trim: true
  },
  proxy: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  }
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
zaloConfigSchema.index({ userId: 1, isActive: 1 });
zaloConfigSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.models.ZaloConfig || mongoose.model<IZaloConfig>('ZaloConfig', zaloConfigSchema);
