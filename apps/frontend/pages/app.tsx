// apps/frontend/pages/app.tsx
import { useEffect, useState } from 'react';
import { encryptItemWithVMK, decryptItemWithVMK } from '../lib/crypto';
import { logout } from '../lib/api';
import { useRouter } from 'next/router';

export default function AppPage() {
  const [vmk, setVmk] = useState<string | null>(null);
  const [ciphertext, setCiphertext] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Just read VMK if present. Do NOT redirect here — _app.tsx handles auth-guard for protected routes.
    const s = sessionStorage.getItem('vmk');
    setVmk(s);
  }, []);

  const handleEncryptSample = async () => {
    if (!vmk) return;
    const item = {
      title: 'Example',
      username: 'alice@example.com',
      password: 'S3cure!x',
      url: 'https://example.com',
      notes: 'sample item',
    };
    const env = await encryptItemWithVMK(vmk, item);
    setCiphertext(env);
    setDecrypted(null);
  };

  const handleDecrypt = async () => {
    if (!vmk || !ciphertext) return;
    const obj = await decryptItemWithVMK(vmk, ciphertext);
    setDecrypted(obj);
  };

  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem('vmk');
    router.push('/');
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Vault (Phase 1)</h1>
      <div>
        <strong>VMK in session:</strong>{' '}
        {vmk ? <code style={{ wordBreak: 'break-all' }}>{vmk}</code> : <em>none</em>}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={handleEncryptSample} disabled={!vmk}>
          Encrypt sample item
        </button>
        <button onClick={handleDecrypt} disabled={!vmk || !ciphertext} style={{ marginLeft: 8 }}>
          Decrypt
        </button>
        <button onClick={handleLogout} style={{ marginLeft: 8 }}>
          Logout
        </button>
      </div>

      {ciphertext && (
        <section style={{ marginTop: 12 }}>
          <h3>Ciphertext (encryptedBlob)</h3>
          <pre style={{ maxWidth: 800, overflowX: 'auto' }}>{ciphertext}</pre>
        </section>
      )}

      {decrypted && (
        <section style={{ marginTop: 12 }}>
          <h3>Decrypted object</h3>
          <pre>{JSON.stringify(decrypted, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
