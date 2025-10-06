// apps/frontend/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function doFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include', // <--- ensure cookies are sent/accepted
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

export function signup(email: string, password: string, encryptedVMK: string) {
  return doFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, encryptedVMK }),
  });
}

export function login(email: string, password: string) {
  return doFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return doFetch('/api/auth/logout', { method: 'POST' });
}
