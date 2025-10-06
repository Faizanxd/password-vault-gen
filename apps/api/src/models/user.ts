import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  encryptedVMK: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  encryptedVMK: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>('User', UserSchema);
