import { Schema, model, Document, Types } from 'mongoose';

export interface IVaultItem extends Document {
  userId: Types.ObjectId;
  encryptedBlob: string;
  createdAt: Date;
  updatedAt: Date;
}

const VaultItemSchema = new Schema<IVaultItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    encryptedBlob: { type: String, required: true },
  },
  { timestamps: true }
);

export const VaultItem = model<IVaultItem>('VaultItem', VaultItemSchema);
