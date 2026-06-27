import { readServiceHealth } from '@/lib/health';
import { readTraffic, PUBLIC_DOMAIN } from '@/lib/cf-analytics';
import { readExperiments } from '@/lib/registry';
import type { ObservabilityData } from '@/lib/observability';

// Served at /api/observability. The dashboard widget fetches this client-side so the home page
// doesn't block on the (slow, multi-day) Cloudflare Analytics calls during SSR. Dynamic so it
// always reflects live service health + traffic.
export const dynamic = 'force-dynamic';

export async function GET() {
  const [health, traffic, experiments] = await Promise.all([
    readServiceHealth(),
    readTraffic(),
    readExperiments(),
  ]);
  const publicExperiments = experiments
    .filter((e) => e.public)
    .map((e) => ({ slug: e.slug, host: `${e.slug}.${PUBLIC_DOMAIN}` }));
  const data: ObservabilityData = { health, traffic, publicExperiments };
  return Response.json(data);
}
