import Link from 'next/dist/client/link';

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Password Vault</h1>
      <p>Minimal starter — generator and vault will live here.</p>
      <Link href="/signup">Go to signup</Link>
      <br />
      <Link href="/login">Go to login</Link>
      <br />
    </main>
  );
}
