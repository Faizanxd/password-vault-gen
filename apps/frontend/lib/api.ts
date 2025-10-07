// apps/frontend/lib/api.ts
const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

async function doFetch(path: string, opts: RequestInit = {}) {
  const url = `${API}${path}`;
  const headers: Record<string, string> = {
    ...(opts.headers ? (opts.headers as Record<string, string>) : {}),
  };

  // If there's a body and no Content-Type specified, default to JSON
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    credentials: 'include', // important: send cookies for auth
    ...opts,
    headers,
  });

  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  // parse JSON body if present
  let body: any = null;
  if (text && contentType.includes('application/json')) {
    try {
      body = JSON.parse(text);
    } catch (err) {
      // invalid JSON — keep raw text
      body = text;
    }
  } else if (text) {
    body = text;
  }

  if (!res.ok) {
    // throw the error object or a fallback
    const err = body || { error: `HTTP ${res.status}` };
    throw err;
  }

  return body;
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
  return (await doFetch('/api/vault', { method: 'GET' })) as Array<{
    id: string;
    encryptedBlob: string;
    createdAt: string;
    updatedAt: string;
  }>;
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
