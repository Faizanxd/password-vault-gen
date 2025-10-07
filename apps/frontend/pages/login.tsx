import { useState } from 'react';
import { useRouter } from 'next/router';
import { login } from '../lib/api';
import { decryptVMK } from '../lib/crypto';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA states
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoginToken(null);
    try {
      const resp: any = await login(email, password);

      // Normal flow: server returned encryptedVMK
      if (resp && resp.encryptedVMK) {
        const vmk = await decryptVMK(resp.encryptedVMK, password);
        sessionStorage.setItem('vmk', vmk);
        router.push('/app');
        return;
      }

      // 2FA required flow
      if (resp && resp.requires2FA && resp.loginToken) {
        setLoginToken(resp.loginToken);
        setError(null);
        // don't redirect yet — show 2FA input UI
        return;
      }

      // Otherwise error
      setError(resp?.error || 'login_failed');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'login_failed');
    } finally {
      setLoading(false);
    }
  };

  // Called when user submits their TOTP code
  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginToken) return setError('missing_login_token');
    if (!code) return setError('enter_code');

    setVerifying2FA(true);
    setError(null);
    try {
      // POST to the 2FA login-verify endpoint (server should set the session cookie on success)
      const r = await fetch(`${API}/api/auth/2fa/login-verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginToken, code }),
      });
      const j = await r.json();

      if (!r.ok || !j.ok) {
        setError(j?.error || 'invalid_2fa_code');
        return;
      }

      // Now we are fully authenticated (session cookie set). Fetch encryptedVMK from /api/auth/me
      const meRes = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      const meJson = await meRes.json();
      if (!meRes.ok || !meJson.encryptedVMK) {
        setError('failed_to_fetch_key');
        return;
      }

      const vmk = await decryptVMK(meJson.encryptedVMK, password);
      sessionStorage.setItem('vmk', vmk);
      // success — go to app
      router.push('/app');
    } catch (err: any) {
      console.error('2fa verify error', err);
      setError(err?.message || '2fa_failed');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleCancel2FA = () => {
    setLoginToken(null);
    setCode('');
    setError(null);
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Log in</h1>

      {!loginToken ? (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, width: 360 }}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          <button disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          {error && <div style={{ color: 'crimson' }}>{error}</div>}
        </form>
      ) : (
        <form onSubmit={handleVerify2FA} style={{ display: 'grid', gap: 8, width: 360 }}>
          <div>
            <p>
              Two-factor authentication is required for this account. Enter the code from your
              authenticator app.
            </p>
          </div>
          <label>
            6-digit code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={8}
            />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={verifying2FA} type="submit">
              {verifying2FA ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={handleCancel2FA}>
              Cancel
            </button>
          </div>

          {error && <div style={{ color: 'crimson' }}>{error}</div>}
        </form>
      )}
    </main>
  );
}
