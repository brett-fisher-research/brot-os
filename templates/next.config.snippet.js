// Reference next.config for an experiment with slug @@SLUG@@.
// The two non-negotiable lines are basePath and output:'standalone'.
/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/@@SLUG@@',
  output: 'standalone', // self-contained server.js for systemd
  // assetPrefix is NOT needed: basePath already prefixes _next assets.
  // trailingSlash keeps the canonical URL at /@@SLUG@@/ — the path Caddy routes
  // on (`handle /@@SLUG@@/*`). Without it Next redirects /@@SLUG@@/ -> /@@SLUG@@,
  // which Caddy can't match, so the app 404s through the proxy.
  trailingSlash: true,
};

module.exports = nextConfig;
