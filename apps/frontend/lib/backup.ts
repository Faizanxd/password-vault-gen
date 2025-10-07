// apps/frontend/lib/backup.ts
import { fetchVault, createVaultItem } from './api';
import { decryptItemWithVMK, encryptItemWithVMK, decryptVMK } from './crypto';

/**
 * Utility helpers (Web Crypto)
 */
function toUint8(b64: string) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function fromUint8(u: Uint8Array) {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

/**
 * Derive AES-GCM key from passphrase (for export passphrase re-encryption)
 */
async function deriveKeyFromPassphrase(passphrase: string, saltB64: string) {
  const enc = new TextEncoder();
  const pass = enc.encode(passphrase);
  const salt = toUint8(saltB64);
  const baseKey = await crypto.subtle.importKey('raw', pass, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
}

// AES-GCM helpers — cast .buffer to ArrayBuffer to satisfy TS BufferSource narrowing
async function aesGcmEncrypt(key: CryptoKey, data: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // cast underlying buffers to ArrayBuffer so TS won't complain about ArrayBufferLike
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );
  return {
    iv: fromUint8(iv),
    ct: fromUint8(new Uint8Array(ct)),
  };
}

async function aesGcmDecrypt(key: CryptoKey, ivB64: string, ctB64: string) {
  const iv = toUint8(ivB64);
  const ct = toUint8(ctB64);

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer
  );
  return new Uint8Array(plain);
}

/**
 * Export vault to a JSON object and download as a file.
 *
 * Options:
 * - exportPassphrase?: if provided, VMK will be encrypted with this passphrase for transport.
 *
 * Export format (v1):
 * {
 *   version: 1,
 *   createdAt: ISO,
 *   protectedWithPassphrase: boolean,
 *   vmkEnvelope?: { salt, iv, ct }   // if protectedWithPassphrase === true
 *   encryptedVMK?: string            // fallback: server-side encryptedVMK (no extra passphrase)
 *   blobs: [ { id, encryptedBlob, createdAt, updatedAt } ]
 * }
 */
export async function exportVaultToFile(opts?: { exportPassphrase?: string; filename?: string }) {
  // Get server-side encryptedVMK from /api/auth/me or from sessionStorage's vmk? We'll include the server's encryptedVMK
  // Easiest: include sessionStorage vmk re-encrypted with passphrase OR include server encryptedVMK (we include both cases)
  const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  // Fetch vault list
  const blobs = await fetchVault(); // array of { id, encryptedBlob, createdAt, updatedAt }

  // attempt to get server-encryptedVMK (we can ask /api/auth/me)
  let encryptedVMKFromServer: string | null = null;
  try {
    const r = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      encryptedVMKFromServer = j.encryptedVMK || null;
    }
  } catch {
    encryptedVMKFromServer = null;
  }

  const exportObj: any = {
    version: 1,
    createdAt: new Date().toISOString(),
    protectedWithPassphrase: false,
    encryptedVMK: encryptedVMKFromServer,
    blobs,
  };

  // If user supplied exportPassphrase, re-encrypt the *client* VMK (from sessionStorage) with that passphrase
  if (opts?.exportPassphrase) {
    const vmkB64 = sessionStorage.getItem('vmk'); // vmk must be present in session (base64)
    if (!vmkB64) throw new Error('VMK not available in session (log in first)');
    // salt + derive key
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = fromUint8(salt);
    const key = await deriveKeyFromPassphrase(opts.exportPassphrase, saltB64);
    // encrypt vmk bytes
    const vmkBytes = toUint8(vmkB64);
    const { iv, ct } = await aesGcmEncrypt(key, vmkBytes);
    exportObj.protectedWithPassphrase = true;
    exportObj.vmkEnvelope = { salt: saltB64, iv, ct };
    // we can still keep the server encryptedVMK as a fallback
    exportObj.encryptedVMK = encryptedVMKFromServer;
  }

  // Create blob and download
  const filename =
    opts?.filename ||
    `vault-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const dataStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Import vault file.
 *
 * Modes:
 * - quick = true: POST encrypted blobs as-is (no decryption). Useful when you're importing into the same account where VMK matches.
 * - quick = false: try to obtain source VMK (either via export passphrase or account password) and re-encrypt for current VMK
 *    Steps: obtain sourceVMK -> for each blob decrypt with sourceVMK -> encrypt with current session VMK -> POST
 *
 * Returns summary { imported: number, skipped: number, errors: [] }
 */
export async function importVaultFromFile(
  file: File,
  opts?: { quick?: boolean; exportPassphrase?: string; accountPasswordForVMK?: string }
) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1) throw new Error('unsupported_export_version');

  const blobs: Array<{ id?: string; encryptedBlob: string }> = parsed.blobs || [];

  // quick import: just POST the encrypted blobs as-is (duplicates filtered)
  if (opts?.quick) {
    const uploaded = new Set<string>();
    let imported = 0;
    const errors: string[] = [];
    for (const b of blobs) {
      if (uploaded.has(b.encryptedBlob)) continue;
      try {
        await createVaultItem(b.encryptedBlob);
        uploaded.add(b.encryptedBlob);
        imported++;
      } catch (err: any) {
        errors.push(String(err?.message || err));
      }
    }
    return { imported, skipped: blobs.length - imported, errors };
  }

  // Otherwise: attempt to obtain source VMK (either via export passphrase or account password / encryptedVMK)
  let sourceVMKb64: string | null = null;

  // 1) try passphrase-based envelope
  if (parsed.protectedWithPassphrase && parsed.vmkEnvelope) {
    if (!opts?.exportPassphrase) throw new Error('export_passphrase_required');
    const { salt, iv, ct } = parsed.vmkEnvelope;
    const key = await deriveKeyFromPassphrase(opts.exportPassphrase, salt);
    try {
      const plain = await aesGcmDecrypt(key, iv, ct); // Uint8Array of base64 string bytes
      const vmkB64 = new TextDecoder().decode(plain);
      sourceVMKb64 = vmkB64;
    } catch {
      throw new Error('invalid_export_passphrase_or_corrupt_export');
    }
  }

  // 2) fallback: if encryptedVMK present and user provided accountPasswordForVMK, use decryptVMK()
  if (!sourceVMKb64 && parsed.encryptedVMK) {
    if (!opts?.accountPasswordForVMK) throw new Error('account_password_required_to_decrypt_vmk');
    // decryptVMK returns base64 VMK string
    sourceVMKb64 = await decryptVMK(parsed.encryptedVMK, opts.accountPasswordForVMK);
  }

  if (!sourceVMKb64) throw new Error('could_not_obtain_source_vmk');

  // Now we have source VMK -> decrypt each item, re-encrypt with current session VMK, upload
  const currentVMKb64 = sessionStorage.getItem('vmk');
  if (!currentVMKb64) throw new Error('current_vmk_missing_in_session (login required)');

  // robust re-encrypt & upload loop (inside importVaultFromFile)
  const errors: string[] = [];
  const seen = new Set<string>();
  let imported = 0;

  // import loop: ensure catch variables are typed 'any' so .message is allowed
  for (const [idx, b] of blobs.entries()) {
    try {
      let plain;
      try {
        plain = await decryptItemWithVMK(sourceVMKb64, b.encryptedBlob);
      } catch (dErr: any) {
        const idLabel = b.id ?? `index:${idx}`;
        errors.push(`decrypt_failed:${idLabel} -> ${String(dErr?.message ?? dErr)}`);
        continue;
      }

      const newCipher = await encryptItemWithVMK(currentVMKb64, plain);

      if (seen.has(newCipher)) continue;

      await createVaultItem(newCipher);
      seen.add(newCipher);
      imported++;
    } catch (err: any) {
      const idLabel = b.id ?? `index:${idx}`;
      errors.push(`upload_failed:${idLabel} -> ${String(err?.message ?? err)}`);
    }
  }

  return { imported, skipped: blobs.length - imported, errors };
}
