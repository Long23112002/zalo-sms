import mongoose from 'mongoose';

export interface ISendLog {
  _id: string;
  userId: string;
  sessionId: string;
  phone: string;
  uid?: string;
  message: string;
  templateId?: string;
  success: boolean;
  error?: string;
  delaySeconds: number;
  sentAt: Date;
}

const sendLogSchema = new mongoose.Schema<ISendLog>({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  uid: { type: String },
  message: { type: String, required: true },
  templateId: { type: String },
  success: { type: Boolean, default: false },
  error: { type: String },
  delaySeconds: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

sendLogSchema.index({ userId: 1, sessionId: 1 });

export default mongoose.models.SendLog || mongoose.model<ISendLog>('SendLog', sendLogSchema);
