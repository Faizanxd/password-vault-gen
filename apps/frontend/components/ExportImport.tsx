// apps/frontend/components/ExportImport.tsx
import React, { useState } from 'react';
import { exportVaultToFile, importVaultFromFile } from '../lib/backup';

type Props = {
  onImported?: () => Promise<void> | void;
};

export default function ExportImport({ onImported }: Props): JSX.Element {
  const [exportPass, setExportPass] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [quickImport, setQuickImport] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [accountPassword, setAccountPassword] = useState(''); // used when file contains server encryptedVMK

  async function handleExport() {
    setExporting(true);
    setStatus(null);
    setErrors(null);
    try {
      await exportVaultToFile({ exportPassphrase: exportPass || undefined });
      setStatus('Export finished. Check your downloads folder.');
    } catch (err: any) {
      setErrors([String(err?.message || err)]);
      setStatus('Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!importFile) {
      setErrors(['No file selected']);
      return;
    }
    setStatus('Importing...');
    setErrors(null);
    try {
      const res = await importVaultFromFile(importFile, {
        quick: quickImport,
        exportPassphrase: exportPass || undefined,
        accountPasswordForVMK: accountPassword || undefined,
      });
      setStatus(`Imported: ${res.imported}. Skipped: ${res.skipped}.`);
      if (res.errors && res.errors.length) setErrors(res.errors);

      // IMPORTANT: let host page refresh the items
      if (onImported) {
        // call and await if it's async
        await onImported();
      }

      // For compatibility with other listeners, also emit a CustomEvent
      try {
        window.dispatchEvent(new CustomEvent('vault:imported', { detail: res }));
      } catch (err) {
        console.warn('dispatchEvent failed', err);
      }
    } catch (err: any) {
      setErrors([String(err?.message || err)]);
      setStatus('Import failed');
    }
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, maxWidth: 760 }}>
      <h3>Export / Import backup</h3>
      <section style={{ marginBottom: 12 }}>
        <h4>Export</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            Optional export passphrase (re-encrypt VMK for transport)
            <input
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              placeholder="passphrase (optional)"
            />
          </label>
          <div>
            <button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export vault (download)'}
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h4>Import</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            Select export file
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={quickImport}
              onChange={(e) => setQuickImport(e.target.checked)}
            />
            Quick import (upload encrypted blobs as-is — use only if this file is from the same
            account)
          </label>

          {!quickImport && (
            <label>
              If the export file is protected by an export passphrase enter it here (or leave empty
              to attempt server-encryptedVMK)
              <input
                value={exportPass}
                onChange={(e) => setExportPass(e.target.value)}
                placeholder="export passphrase (optional)"
              />
            </label>
          )}

          {!quickImport && !exportPass && (
            <label>
              If file does not include a passphrase-protected VMK you can provide your original
              account password to decrypt the exported encryptedVMK.
              <input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="original account password (optional)"
              />
            </label>
          )}

          <div>
            <button onClick={handleImport}>Import</button>
          </div>

          {status && <div style={{ marginTop: 8 }}>{status}</div>}
          {errors && errors.length > 0 && (
            <div style={{ color: 'crimson', marginTop: 8 }}>
              <div>Errors:</div>
              <ul>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
