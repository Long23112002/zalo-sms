import mongoose from 'mongoose';

export interface ITemplate {
  _id: string;
  userId: string;
  name: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new mongoose.Schema<ITemplate>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  variables: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
templateSchema.index({ userId: 1, isActive: 1 });
templateSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.models.Template || mongoose.model<ITemplate>('Template', templateSchema);
