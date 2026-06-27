'use client';
// Loads the shared platform sidebar (served at /platform-sidebar.js by this app and
// reachable from every experiment via Caddy's root fallback). Rendered once in the
// root layout. The same tiny component is vendored into each promoted experiment.
import { useEffect } from 'react';

export default function PlatformSidebar() {
  useEffect(() => {
    if (document.getElementById('platform-sidebar-js')) return;
    const s = document.createElement('script');
    s.id = 'platform-sidebar-js';
    s.src = '/platform-sidebar.js';
    s.defer = true;
    document.body.appendChild(s);
  }, []);
  return null;
}
