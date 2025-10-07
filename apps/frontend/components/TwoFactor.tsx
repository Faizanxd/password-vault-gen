// apps/frontend/components/TwoFactor.tsx
import React, { useState } from 'react';
import QRCode from 'qrcode';
import { setup2fa, confirm2fa, disable2fa } from '../lib/api';

type Props = object;

export default function TwoFactor(_: Props) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSetup() {
    setStatus(null);
    setBusy(true);
    try {
      const resp = await setup2fa();
      // resp should be { otpauthUrl, tempToken }
      if (resp && resp.otpauthUrl && resp.tempToken) {
        setTempToken(resp.tempToken);
        const dataUrl = await QRCode.toDataURL(resp.otpauthUrl);
        setQrSrc(dataUrl);
        setStatus('Scan the QR with your authenticator and enter the current code to confirm.');
      } else {
        setStatus('Failed to generate QR code (unexpected server response).');
        console.warn('setup2fa unexpected response', resp);
      }
    } catch (err: any) {
      console.error('setup2fa error', err);
      setStatus(err?.error || String(err) || 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!tempToken) return setStatus('missing token');
    setStatus(null);
    setBusy(true);
    try {
      const resp = await confirm2fa(tempToken, code);
      if (resp && resp.ok) {
        setStatus('2FA enabled');
        setQrSrc(null);
        setTempToken(null);
        setCode('');
      } else {
        setStatus(resp?.error || 'Invalid code');
      }
    } catch (err: any) {
      console.error('confirm2fa error', err);
      setStatus(err?.error || String(err) || 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setStatus(null);
    setBusy(true);
    try {
      const resp = await disable2fa(code);
      if (resp && resp.ok) {
        setStatus('2FA disabled');
        setCode('');
      } else {
        setStatus(resp?.error || 'Disable failed');
      }
    } catch (err: any) {
      console.error('disable2fa error', err);
      setStatus(err?.error || String(err) || 'Disable failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8 }}>
      <h3>Two-Factor Authentication (TOTP)</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSetup} disabled={busy}>
          Start setup (Show QR)
        </button>
      </div>

      {qrSrc && (
        <div style={{ marginTop: 12 }}>
          <img src={qrSrc} alt="TOTP QR code" style={{ width: 200, height: 200 }} />
          <div style={{ marginTop: 8 }}>
            <label>
              Enter current code from your authenticator:
              <input value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div style={{ marginTop: 8 }}>
              <button onClick={handleConfirm} disabled={busy}>
                Confirm & Enable
              </button>
              <button
                onClick={() => {
                  setQrSrc(null);
                  setTempToken(null);
                  setStatus(null);
                }}
                style={{ marginLeft: 8 }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label>
          To disable, enter current code:
          <input value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <div style={{ marginTop: 8 }}>
          <button onClick={handleDisable} disabled={busy}>
            Disable 2FA
          </button>
        </div>
      </div>

      {status && (
        <div
          style={{
            marginTop: 10,
            color: status.includes('failed') || status.includes('invalid') ? 'crimson' : 'green',
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
