import { useState } from 'react';
import { useRouter } from 'next/router';
import { login } from '../lib/api';
import { decryptVMK } from '../lib/crypto';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await login(email, password);
      if ((resp as any).encryptedVMK) {
        const vmk = await decryptVMK((resp as any).encryptedVMK, password);
        sessionStorage.setItem('vmk', vmk);
        router.push('/app');
      } else {
        setError((resp as any).error || 'login_failed');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'login_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Log in</h1>
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
    </main>
  );
}
