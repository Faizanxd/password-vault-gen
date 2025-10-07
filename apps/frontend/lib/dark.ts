export function setTheme(isDark: boolean) {
  try {
    localStorage.setItem('pv_theme', isDark ? 'dark' : 'light');
  } catch {
    // Ignore localStorage errors (e.g., in private mode)
  }
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export function getTheme(): 'dark' | 'light' {
  try {
    const v = localStorage.getItem('pv_theme');
    if (v === 'dark' || v === 'light') return v;
  } catch {
    // Ignore localStorage errors (e.g., in private mode)
  }
  // fallback to prefers-color-scheme
  if (typeof window !== 'undefined') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  return 'light';
}
