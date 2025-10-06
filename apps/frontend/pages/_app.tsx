// apps/frontend/pages/_app.tsx
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import '../styles/globals.css';

// Only routes that require an authenticated session (VMK present).
const protectedRoutes = ['/app'];

function isProtected(pathname: string) {
  return protectedRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Only run client-side
    const pathname = window.location.pathname;

    if (isProtected(pathname)) {
      const vmk = sessionStorage.getItem('vmk');
      if (!vmk) {
        // Use replace so back button doesn't go to the protected page
        router.replace('/login');
      }
    }
    // Do nothing for public routes (/, /signup, /login)
  }, [router]);

  return <Component {...pageProps} />;
}
