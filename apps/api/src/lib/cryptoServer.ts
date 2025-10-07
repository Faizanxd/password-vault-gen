// AES-GCM encryption helpers for server storage of TOTP secrets
import crypto from 'crypto';

const KEY_B64 = process.env.TOTP_SERVER_KEY_B64 || ''; // must be 32 bytes base64 in env for production

if (!KEY_B64) {
  console.warn(
    'TOTP_SERVER_KEY_B64 not set — TOTP secrets storage will fail in production. Use a strong 32-byte base64 key.'
  );
}

export function getKey() {
  const k = Buffer.from(KEY_B64, 'base64');
  if (k.length !== 32) throw new Error('TOTP server key must be 32 bytes (base64-encoded)');
  return k;
}

export function encryptServer(plain: string) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as base64 iv:tag:ct
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptServer(envelope: string) {
  const key = getKey();
  const [ivB64, tagB64, ctB64] = envelope.split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('invalid envelope');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString('utf8');
}
