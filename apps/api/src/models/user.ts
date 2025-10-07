// apps/api/src/models/user.ts
import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  encryptedVMK: string;
  // optional TOTP fields for Phase 5
  totpSecretEncrypted?: string;
  totpEnabled?: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  encryptedVMK: { type: String, required: true },
  totpSecretEncrypted: { type: String, required: false }, // encrypted TOTP secret
  totpEnabled: { type: Boolean, default: false }, // whether 2FA is enabled
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>('User', UserSchema);
