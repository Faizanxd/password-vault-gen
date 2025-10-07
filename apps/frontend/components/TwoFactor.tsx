// apps/frontend/components/TwoFactor.tsx
import React, { useState } from 'react';
import QRCode from 'qrcode';

type Props = object;

export default function TwoFactor(_: Props) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSetup() {
    setStatus(null);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/2fa/setup`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (json.otpauthUrl && json.tempToken) {
      setTempToken(json.tempToken);
      const dataUrl = await QRCode.toDataURL(json.otpauthUrl);
      setQrSrc(dataUrl);
    } else {
      setStatus('failed to generate QR');
    }
  }

  async function handleConfirm() {
    if (!tempToken) return setStatus('missing token');
    setStatus(null);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/2fa/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code }),
    });
    const json = await res.json();
    if (json.ok) {
      setStatus('2FA enabled');
      setQrSrc(null);
      setTempToken(null);
      setCode('');
    } else {
      setStatus(json.error || 'invalid code');
    }
  }

  async function handleDisable() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/2fa/disable`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (json.ok) setStatus('2FA disabled');
    else setStatus(json.error || 'disable failed');
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8 }}>
      <h3>Two-Factor Authentication (TOTP)</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSetup}>Start setup (Show QR)</button>
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
              <button onClick={handleConfirm}>Confirm & Enable</button>
              <button
                onClick={() => {
                  setQrSrc(null);
                  setTempToken(null);
                }}
                style={{ marginLeft: 8 }}
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
          <button onClick={handleDisable}>Disable 2FA</button>
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
