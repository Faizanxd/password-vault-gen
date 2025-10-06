import { useState } from 'react';
import { useRouter } from 'next/router';
import { generateVMK, encryptVMK } from '../lib/crypto';
import { signup } from '../lib/api';

export default function Signup() {
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
      const vmk = await generateVMK();
      const encryptedVMK = await encryptVMK(vmk, password);
      const resp = await signup(email, password, encryptedVMK);
      if ((resp as any).ok) {
        sessionStorage.setItem('vmk', vmk); // base64 VMK
        router.push('/app');
      } else {
        setError((resp as any).error || 'signup_failed');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'signup_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Sign up</h1>
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
          {loading ? 'Creating...' : 'Create account'}
        </button>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
      </form>
    </main>
  );
}
