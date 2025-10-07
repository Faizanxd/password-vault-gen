// apps/frontend/pages/app.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { encryptItemWithVMK, decryptItemWithVMK } from '../lib/crypto';
import { fetchVault, createVaultItem, updateVaultItem, deleteVaultItem, logout } from '../lib/api';
import { useRouter } from 'next/router';
import Fuse from 'fuse.js';
import Generator from '../components/Generator';
import TwoFactor from '../components/TwoFactor';
import DarkToggle from '../components/DarkToggle';

type RemoteItem = { id: string; encryptedBlob: string; createdAt: string; updatedAt: string };
type DecryptedItem = {
  id: string;
  encryptedBlob: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  folder?: string;
};

export default function VaultPage() {
  const [vmk, setVmk] = useState<string | null>(null);
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [loading, setLoading] = useState(false);

  // form state (create/edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    tagsText: '',
    folder: '',
  });

  // Search + filter state
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showOnlyTagged, setShowOnlyTagged] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Derived filtered result (what we actually render)
  const [filtered, setFiltered] = useState<DecryptedItem[]>([]);

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const router = useRouter();
  const searchDebounceRef = useRef<number | null>(null);

  // Load VMK and items
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

  // Build a tag list from decrypted items (used for filter UI)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (Array.isArray(it.tags)) for (const t of it.tags) if (t && t.trim()) set.add(t.trim());
    }
    return Array.from(set).sort();
  }, [items]);

  // Build folder list
  const allFolders = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const f = (it.folder || '').trim();
      if (f) set.add(f);
    }
    return Array.from(set).sort();
  }, [items]);

  // Fuse config (fuzzy search). Keys correspond to fields inside decrypted items.
  const fuseIndex = useMemo(() => {
    try {
      return new Fuse(items, {
        keys: ['title', 'username', 'url', 'notes'],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 1,
      });
    } catch {
      return null;
    }
  }, [items]);

  // Debounce typing, but apply immediately on toggles/items/folder changes
  useEffect(() => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const q = query.trim();
    const shouldDebounce = q.length > 0;

    if (shouldDebounce) {
      searchDebounceRef.current = window.setTimeout(() => {
        applyFilters();
        searchDebounceRef.current = null;
      }, 150);
    } else {
      applyFilters();
    }

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
    // run when these change
  }, [query, selectedTags, showOnlyTagged, items, selectedFolder]);

  function applyFilters() {
    const q = query.trim();
    let base: DecryptedItem[] = items.slice();

    // normalize tags for every item (trim & filter empties)
    const normalizeTags = (it: DecryptedItem) =>
      (it.tags ?? []).map((t) => String(t || '').trim()).filter(Boolean);

    // Folder filter
    if (selectedFolder) {
      base = base.filter((it) => (it.folder || '').trim() === selectedFolder);
    }

    // Tag filter (applies before search)
    if (selectedTags.size > 0 || showOnlyTagged) {
      base = base.filter((it) => {
        const tags = normalizeTags(it);
        if (showOnlyTagged && tags.length === 0) return false;
        if (selectedTags.size > 0) {
          for (const t of Array.from(selectedTags)) {
            if (!tags.includes(t)) return false;
          }
        }
        return true;
      });
    }

    // Search: use Fuse if available and query length > 0
    if (q.length > 0 && fuseIndex) {
      const results = fuseIndex.search(q);
      const ids = new Set(results.map((r) => r.item.id));
      base = base.filter((it) => ids.has(it.id));
    } else if (q.length > 0) {
      // Fallback: substring match (case-insensitive)
      const lower = q.toLowerCase();
      base = base.filter(
        (it) =>
          (it.title || '').toLowerCase().includes(lower) ||
          (it.username || '').toLowerCase().includes(lower) ||
          (it.url || '').toLowerCase().includes(lower) ||
          (it.notes || '').toLowerCase().includes(lower)
      );
    }

    setFiltered(base);
  }

  async function loadItems() {
    setLoading(true);
    try {
      const remote = await fetchVault();
      const decrypted: DecryptedItem[] = [];
      for (const r of remote as RemoteItem[]) {
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
            tags: Array.isArray(plain.tags)
              ? plain.tags.map((t: any) => String(t).trim()).filter(Boolean)
              : [],
            folder: (plain.folder || '').toString(),
          });
        } catch (err) {
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
            tags: [],
            folder: '',
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

  // CRUD handlers (create/edit/delete) — incorporate tags and folder parsing
  async function handleCreateOrUpdate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!vmk) return;
    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      title: form.title || '',
      username: form.username || '',
      password: form.password || '',
      url: form.url || '',
      notes: form.notes || '',
      tags,
      folder: form.folder || '',
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

  function resetForm() {
    setEditingId(null);
    setForm({
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
      tagsText: '',
      folder: '',
    });
  }

  function startEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      username: item.username || '',
      password: item.password || '',
      url: item.url || '',
      notes: item.notes || '',
      tagsText: (item.tags || []).join(', '),
      folder: item.folder || '',
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

  // Tag filter toggles
  function toggleTag(t: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // Clear search & filters
  function clearFilters() {
    setQuery('');
    setSelectedTags(new Set());
    setShowOnlyTagged(false);
    setSelectedFolder(null);
  }

  // Keep filtered in sync on first load and when items change
  useEffect(() => {
    applyFilters();
  }, [items]);

  return (
    <main style={{ padding: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Password Vault</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <small style={{ marginRight: 6 }}>Folder:</small>
            <select
              value={selectedFolder ?? ''}
              onChange={(e) => setSelectedFolder(e.target.value || null)}
              aria-label="Filter by folder"
            >
              <option value="">All</option>
              {allFolders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <button onClick={() => setSettingsOpen((s) => !s)} aria-pressed={settingsOpen}>
            {settingsOpen ? 'Close settings' : 'Settings'}
          </button>

          <div style={{ minWidth: 160 }}>
            <h3 style={{ marginTop: 0 }}>Appearance</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DarkToggle />
              <div style={{ fontSize: 13, color: '#666' }}>Toggle dark mode</div>
            </div>
          </div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Settings panel (simple inline panel) */}
      {settingsOpen && (
        <section
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #e6e6e6',
            borderRadius: 8,
            maxWidth: 900,
          }}
        >
          <h2>Settings</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 280 }}>
              <h3 style={{ marginTop: 0 }}>Two-Factor (TOTP)</h3>
              <TwoFactor />
            </div>
          </div>
        </section>
      )}

      {/* Editor */}
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
          <input
            placeholder="Tags (comma separated)"
            value={form.tagsText}
            onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
          />
          <input
            placeholder="Folder (optional)"
            value={form.folder}
            onChange={(e) => setForm({ ...form, folder: e.target.value })}
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

      {/* Generator (prefills password field) */}
      <div style={{ marginTop: 16 }}>
        <Generator onGenerate={(pwd) => setForm((f) => ({ ...f, password: pwd }))} />
      </div>

      {/* Search & filters */}
      <section style={{ marginTop: 24, maxWidth: 900 }}>
        <h2>Search & Filters</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            placeholder="Search title, username, URL, notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: 8 }}
            aria-label="Search vault items"
          />
          <button onClick={() => setQuery('')}>Clear</button>
          <button onClick={() => clearFilters()} style={{ marginLeft: 8 }}>
            Reset
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showOnlyTagged}
              onChange={(e) => setShowOnlyTagged(e.target.checked)}
            />
            Show only items with tags
          </label>

          {allTags.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allTags.map((t) => (
                <label
                  key={t}
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    background: selectedTags.has(t) ? '#eef' : 'transparent',
                    padding: '4px 6px',
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.has(t)}
                    onChange={() => toggleTag(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          ) : (
            <div style={{ color: '#666' }}>No tags yet</div>
          )}
        </div>
      </section>

      {/* Vault List */}
      <section style={{ marginTop: 24 }}>
        <h2>Vault</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.length === 0 && <div>No items match your search/filters.</div>}
            {filtered.map((it) => (
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
                    <small>Password:</small>
                    <code>{it.password ? '••••••••' : ''}</code>
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

                  {/* Folder */}
                  {it.folder && it.folder.trim() && (
                    <div style={{ marginTop: 6 }}>
                      <small>Folder:</small>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{it.folder}</div>
                    </div>
                  )}

                  {/* Tags */}
                  {it.tags && it.tags.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <small>Tags:</small>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {it.tags.map((rawTag) => {
                          const t = String(rawTag || '').trim();
                          if (!t) return null;
                          return (
                            <span
                              key={t}
                              style={{
                                background: '#f2f6ff',
                                color: '#0b3b82',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                display: 'inline-block',
                              }}
                            >
                              {t}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Encrypted blob (debug)</summary>
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
