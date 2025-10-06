// apps/frontend/pages/app.tsx
import { useEffect, useState } from 'react';
import { encryptItemWithVMK, decryptItemWithVMK } from '../lib/crypto';
import { fetchVault, createVaultItem, updateVaultItem, deleteVaultItem, logout } from '../lib/api';
import { useRouter } from 'next/router';

type DecryptedItem = {
  id: string;
  encryptedBlob: string;
  createdAt: string;
  updatedAt: string;
  // plaintext fields:
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
};

export default function VaultPage() {
  const [vmk, setVmk] = useState<string | null>(null);
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', username: '', password: '', url: '', notes: '' });
  const [showPasswordIds, setShowPasswordIds] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    const s = sessionStorage.getItem('vmk');
    if (!s) {
      router.replace('/login');
      return;
    }
    setVmk(s);
  }, [router]);

  useEffect(() => {
    if (!vmk) return;
    loadItems();
  }, [vmk]);

  async function loadItems() {
    setLoading(true);
    try {
      const remote = await fetchVault();
      // remote is array of {id, encryptedBlob}
      const decrypted: DecryptedItem[] = [];
      for (const r of remote as any[]) {
        try {
          const plain = await decryptItemWithVMK(vmk!, r.encryptedBlob);
          decrypted.push({
            id: r.id,
            encryptedBlob: r.encryptedBlob,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            title: plain.title || '',
            username: plain.username || '',
            password: plain.password || '',
            url: plain.url || '',
            notes: plain.notes || '',
          });
        } catch (err) {
          // If decryption fails for an item, still include the ciphertext so user can debug later
          console.error('decrypt item failed', r.id, err);
          decrypted.push({
            id: r.id,
            encryptedBlob: r.encryptedBlob,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            title: '[decryption_failed]',
            username: '',
            password: '',
            url: '',
            notes: '',
          });
        }
      }
      setItems(decrypted);
    } catch (err) {
      console.error('loadItems error', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({ title: '', username: '', password: '', url: '', notes: '' });
  }

  async function handleCreateOrUpdate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!vmk) return;
    const payload = {
      title: form.title || '',
      username: form.username || '',
      password: form.password || '',
      url: form.url || '',
      notes: form.notes || '',
    };
    const encryptedBlob = await encryptItemWithVMK(vmk, payload);
    try {
      if (editingId) {
        await updateVaultItem(editingId, encryptedBlob);
      } else {
        await createVaultItem(encryptedBlob);
      }
      await loadItems();
      resetForm();
    } catch (err) {
      console.error('save item error', err);
    }
  }

  function startEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      username: item.username || '',
      password: item.password || '',
      url: item.url || '',
      notes: item.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteVaultItem(id);
      setItems((s) => s.filter((it) => it.id !== id));
    } catch (err) {
      console.error('delete error', err);
    }
  }

  async function handleLogout() {
    await logout();
    sessionStorage.removeItem('vmk');
    router.push('/');
  }

  function toggleShowPassword(id: string) {
    setShowPasswordIds((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <main style={{ padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Password Vault</h1>
        <div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section style={{ marginTop: 16 }}>
        <h2>{editingId ? 'Edit item' : 'Add new item'}</h2>
        <form onSubmit={handleCreateOrUpdate} style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            placeholder="URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div>
            <button type="submit">{editingId ? 'Save changes' : 'Add item'}</button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ marginLeft: 8 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Vault</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.length === 0 && <div>No items yet.</div>}
            {items.map((it) => (
              <div
                key={it.id}
                style={{ border: '1px solid #e2e2e2', padding: 12, borderRadius: 8 }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <strong>{it.title}</strong>
                  <div>
                    <button onClick={() => startEdit(it)}>Edit</button>
                    <button onClick={() => handleDelete(it.id)} style={{ marginLeft: 8 }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div>
                    <small>Username:</small> <code>{it.username}</code>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <small>Password:</small>{' '}
                    <code>
                      {showPasswordIds[it.id] ? it.password : it.password ? '••••••••' : ''}
                    </code>
                    <button onClick={() => toggleShowPassword(it.id)} style={{ marginLeft: 8 }}>
                      {showPasswordIds[it.id] ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <small>URL:</small>{' '}
                    <a href={it.url} target="_blank" rel="noreferrer">
                      {it.url}
                    </a>
                  </div>
                  {it.notes && (
                    <div style={{ marginTop: 6 }}>
                      <small>Notes:</small>
                      <div>{it.notes}</div>
                    </div>
                  )}
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Encrypted blob (for debug)</summary>
                  <pre style={{ maxWidth: 800, overflowX: 'auto' }}>{it.encryptedBlob}</pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
