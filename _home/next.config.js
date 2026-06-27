/** @type {import('next').NextConfig} */
// The home dashboard serves the ROOT route '/', so unlike experiments it has NO basePath.
// output: 'standalone' so it runs as a self-contained systemd service (see bin/rebuild-home.sh).
// trailingSlash: the dashboard's own API + the cross-service URLs it builds use trailing slashes
//   (e.g. /api/observability/, /bookshelf/api/cover/<id>/ routed to the bookshelf service via
//   Caddy) — keep them canonical so there's no redirect hop.
// images.unoptimized: the "Currently reading" widget renders remote cover art with plain <img>.
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
