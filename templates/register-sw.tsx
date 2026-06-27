'use client';
// Drop this component into the root layout (rendered once) to register the
// service worker for an experiment served under /@@SLUG@@/.
import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/@@SLUG@@/sw.js', { scope: '/@@SLUG@@/' })
      .catch((err) => console.error('SW registration failed:', err));
  }, []);
  return null;
}
