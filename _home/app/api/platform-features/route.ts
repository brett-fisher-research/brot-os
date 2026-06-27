import { readFeatures } from '@/lib/features';

// Served at /api/platform-features (reachable from every experiment via Caddy's root
// fallback). Dynamic so promote/demote shows instantly with no rebuild of any app.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ features: await readFeatures() });
}
