// client-side Web Crypto helpers for VMK lifecycle and item encryption
// VMK envelope (encrypted by password) format:
//   base64(salt) + ':' + base64(iv) + ':' + base64(ciphertext)
// Item envelope (encrypted with VMK) format:
//   base64(iv) + ':' + base64(ciphertext)
// VMK is represented as base64(raw 32 bytes) when stored in sessionStorage.

// helper base64 <-> ArrayBuffer
function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromB64(s: string) {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

// VMK lifecycle (password-protected)
export async function generateVMK(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return toB64(key.buffer); // base64 encoded raw key
}

export async function deriveKey(password: string, saltB64: string) {
  const pwUtf8 = new TextEncoder().encode(password);
  const salt = fromB64(saltB64);
  const baseKey = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveKey']);
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return derived;
}

export async function encryptVMK(vmkB64: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, toB64(salt.buffer));
  const vmkBuf = fromB64(vmkB64);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, vmkBuf);
  return `${toB64(salt.buffer)}:${toB64(iv.buffer)}:${toB64(ct)}`;
}

export async function decryptVMK(envelope: string, password: string) {
  const [saltB64, ivB64, ctB64] = envelope.split(':');
  if (!saltB64 || !ivB64 || !ctB64) throw new Error('invalid_envelope');
  const key = await deriveKey(password, saltB64);
  const iv = fromB64(ivB64);
  const ct = fromB64(ctB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return toB64(plain); // base64 raw VMK
}

// Convert VMK (base64 raw) into CryptoKey for item encryption
export async function vmkToCryptoKey(vmkB64: string) {
  const vmkBuf = fromB64(vmkB64);
  return crypto.subtle.importKey('raw', vmkBuf, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Encrypt/decrypt JSON objects using VMK (AES-GCM)
export async function encryptItemWithVMK(vmkB64: string, obj: Record<string, any>) {
  const key = await vmkToCryptoKey(vmkB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return `${toB64(iv.buffer)}:${toB64(ct)}`; // store this as encryptedBlob
}

export async function decryptItemWithVMK(vmkB64: string, envelope: string) {
  const [ivB64, ctB64] = envelope.split(':');
  if (!ivB64 || !ctB64) throw new Error('invalid_item_envelope');
  const key = await vmkToCryptoKey(vmkB64);
  const iv = fromB64(ivB64);
  const ct = fromB64(ctB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json);
}
