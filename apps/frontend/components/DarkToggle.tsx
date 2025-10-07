// apps/frontend/components/DarkToggle.tsx
import React, { useEffect, useState } from 'react';
import { getTheme, setTheme } from '../lib/dark';

export default function DarkToggle(): JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(() => getTheme() === 'dark');

  // ensure document/theme is set on mount and whenever the state changes
  useEffect(() => {
    setTheme(isDark);
  }, [isDark]);

  // allow external changes to local preference (optional)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pv_theme') {
        setIsDark(getTheme() === 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => setIsDark((s) => !s);

  return (
    <button
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #ddd',
        background: 'var(--card, #fff)',
        color: 'var(--text, #111)',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 14 }}>{isDark ? '🌙' : '☀️'}</span>
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
