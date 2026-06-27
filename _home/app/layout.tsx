import type { Metadata, Viewport } from 'next';
import './globals.css';
import PlatformSidebar from './platform-sidebar';

export const metadata: Metadata = {
  title: 'Experiments',
  description: 'claude-experiments dashboard',
};

export const viewport: Viewport = {
  themeColor: '#0b0f17',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Shared platform chrome (the "← Home" convention), SSR'd into <head> by
            React's precedence-managed stylesheet so it's render-blocking — no flash.
            platform-sidebar.js also injects this as a fallback for surfaces that don't
            link it statically; the JS dedupes against this tag by href. */}
        <link rel="stylesheet" href="/platform-chrome.css" precedence="default" />
        <PlatformSidebar />
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
