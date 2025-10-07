// apps/frontend/components/Generator.tsx
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  initialLength?: number;
  onGenerate?: (pwd: string) => void;
  defaultCopyClearMs?: number;
};

const LOOK_ALIKES = new Set(['0', 'O', 'o', '1', 'l', 'I']);
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>/?';

function buildCharset(opts: {
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeLookAlikes: boolean;
}) {
  let s = '';
  if (opts.lower) s += LOWER;
  if (opts.upper) s += UPPER;
  if (opts.digits) s += DIGITS;
  if (opts.symbols) s += SYMBOLS;
  if (opts.excludeLookAlikes) {
    s = Array.from(s)
      .filter((ch) => !LOOK_ALIKES.has(ch))
      .join('');
  }
  return s;
}

function generateWithCrypto(charset: string, length: number) {
  if (!charset || charset.length === 0) return '';
  const out: string[] = [];
  const charsetLen = charset.length;
  const rnd = new Uint32Array(length);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < length; i++) {
    out.push(charset[rnd[i] % charsetLen]);
  }
  return out.join('');
}

export default function Generator({
  initialLength = 16,
  onGenerate,
  defaultCopyClearMs = 15_000,
}: Props) {
  const [length, setLength] = useState<number>(initialLength);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeLookAlikes, setExcludeLookAlikes] = useState(false);

  // password state is controlled and only updated by handleGenerate or parent via onGenerate callback
  const [password, setPassword] = useState('');

  const [copied, setCopied] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const ariaRef = useRef<HTMLDivElement | null>(null);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // This function is called only when user clicks Generate (or parent explicitly calls onGenerate).
  const handleGenerate = () => {
    const charset = buildCharset({ lower, upper, digits, symbols, excludeLookAlikes });
    if (!charset) {
      setPassword('');
      return;
    }
    const pwd = generateWithCrypto(charset, length);
    setPassword(pwd);
    if (onGenerate) onGenerate(pwd);
    if (ariaRef.current) ariaRef.current.textContent = 'New password generated';
  };

  const clearCopyState = async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // best-effort; ignore failures
    }
    setCopied(false);
    setCountdownSec(null);
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setCountdownSec(Math.ceil(defaultCopyClearMs / 1000));

      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdownSec((s) => {
          if (!s || s <= 1) {
            if (countdownIntervalRef.current) {
              window.clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return null;
          }
          return s - 1;
        });
      }, 1000);

      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(async () => {
        await clearCopyState();
      }, defaultCopyClearMs);
    } catch (err) {
      console.error('Copy failed', err);
      if (ariaRef.current) ariaRef.current.textContent = 'Copy failed: clipboard permission denied';
    }
  };

  const cancelAutoClear = () => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownSec(null);
    setCopied(false);
  };

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>Password generator</h3>
        <div style={{ fontSize: 12, color: '#666' }}>Client-side only</div>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <label>
          <div style={{ fontSize: 13 }}>
            Length: <strong>{length}</strong>
          </div>
          <input
            aria-label="Password length"
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </label>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input checked={lower} onChange={(e) => setLower(e.target.checked)} type="checkbox" />
            <span>lowercase</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input checked={upper} onChange={(e) => setUpper(e.target.checked)} type="checkbox" />
            <span>UPPERCASE</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input checked={digits} onChange={(e) => setDigits(e.target.checked)} type="checkbox" />
            <span>digits</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
              type="checkbox"
            />
            <span>symbols</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              checked={excludeLookAlikes}
              onChange={(e) => setExcludeLookAlikes(e.target.checked)}
              type="checkbox"
            />
            <span>exclude look-alikes (0,O,1,l,I)</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleGenerate} aria-label="Generate password">
            Generate
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* explicit visible input styling so generated value is not accidentally hidden by global styles */}
            <input
              aria-label="Generated password"
              readOnly
              value={password}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                padding: '6px 8px',
                color: '#111', // force visible text color
                background: '#fff', // ensure contrast
                border: '1px solid #e6e6e6',
                borderRadius: 6,
              }}
            />
            <button
              onClick={handleCopy}
              disabled={!password}
              aria-pressed={copied}
              aria-label={
                copied
                  ? `Copied. Will clear in ${
                      countdownSec ?? Math.ceil(defaultCopyClearMs / 1000)
                    } seconds`
                  : 'Copy password to clipboard'
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {copied && <button onClick={cancelAutoClear}>Keep</button>}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#666' }}>
          Tip: generate, copy, then paste where needed. Passwords are generated client-side only.
        </div>
      </div>

      <div ref={ariaRef} role="status" aria-live="polite" style={{ marginTop: 12, minHeight: 20 }}>
        {copied
          ? `Copied — will clear in ${countdownSec ?? Math.ceil(defaultCopyClearMs / 1000)}s`
          : ''}
      </div>
    </div>
  );
}
