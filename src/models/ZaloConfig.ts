import mongoose, { Document, Schema } from 'mongoose';

export interface IZaloConfig extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  cookie: string;
  imei: string;
  userAgent: string;
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
    type: String,
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
