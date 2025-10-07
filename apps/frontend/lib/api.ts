const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

async function doFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  // return raw text (for 204 or other)
  return res.text();
}

/* Auth */
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

/* Vault endpoints */
export async function fetchVault() {
  return doFetch('/api/vault', { method: 'GET' }) as Promise<
    Array<{ id: string; encryptedBlob: string; createdAt: string; updatedAt: string }>
  >;
}

export async function createVaultItem(encryptedBlob: string) {
  return doFetch('/api/vault', {
    method: 'POST',
    body: JSON.stringify({ encryptedBlob }),
  });
}

export async function updateVaultItem(id: string, encryptedBlob: string) {
  return doFetch(`/api/vault/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ encryptedBlob }),
  });
}

export async function deleteVaultItem(id: string) {
  return doFetch(`/api/vault/${id}`, { method: 'DELETE' });
}
