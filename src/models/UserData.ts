import mongoose from 'mongoose';

export interface IUserData {
  _id: string;
  userId: string;
  phone: string;
  xxx?: string;
  yyy?: string;
  sdt?: string;
  ttt?: string;
  zzz?: string;
  www?: string;
  uuu?: string;
  vvv?: string;
  customFields?: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userDataSchema = new mongoose.Schema<IUserData>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  xxx: { type: String, trim: true },
  yyy: { type: String, trim: true },
  sdt: { type: String, trim: true },
  ttt: { type: String, trim: true },
  zzz: { type: String, trim: true },
  www: { type: String, trim: true },
  uuu: { type: String, trim: true },
  vvv: { type: String, trim: true },
  customFields: {
    type: Map,
    of: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
userDataSchema.index({ userId: 1, phone: 1 }, { unique: true });
userDataSchema.index({ userId: 1, isActive: 1 });

export default mongoose.models.UserData || mongoose.model<IUserData>('UserData', userDataSchema);
