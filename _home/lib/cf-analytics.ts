// Server-side traffic stats from Cloudflare's GraphQL Analytics API. Because public experiments
// are proxied through Cloudflare's edge, it already counts every request per hostname — no tracking
// code in any experiment. Reads creds injected by the systemd unit (cloudflare.env); when they are
// absent the dashboard degrades to a "not configured" hint instead of erroring.
const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

// brettfisher.dev apex — public experiments live at <slug>.PUBLIC_DOMAIN.
export const PUBLIC_DOMAIN = 'brettfisher.dev';

export type HostTraffic = { requests: number; bytes: number };

export type TrafficReport = {
  // False when no API token/zone is configured — the widget shows a setup hint.
  configured: boolean;
  // True when configured but the API call failed (network, bad token, retention) — show a soft error.
  error: boolean;
  windowDays: number;
  // Keyed by hostname, e.g. "monty-hall.brettfisher.dev".
  byHost: Record<string, HostTraffic>;
};

// httpRequestsAdaptiveGroups is sampled: estimate true counts as count * avg(sampleInterval).
type AdaptiveGroup = {
  count?: number;
  avg?: { sampleInterval?: number };
  sum?: { edgeResponseBytes?: number };
  dimensions?: { clientRequestHTTPHost?: string };
};
type GraphQLResponse = {
  data?: { viewer?: { zones?: Array<{ httpRequestsAdaptiveGroups?: AdaptiveGroup[] }> } };
  errors?: Array<{ message?: string }>;
};

const DAY_MS = 86_400_000;
// Free-plan adaptive analytics caps each query at a 1-day span and retains only a few days, so we
// fan out one 24h query per day and sum. Keep the window modest (clamped) to bound the API calls.
const WINDOW_DAYS = Math.min(14, Math.max(1, Number(process.env.CF_ANALYTICS_DAYS ?? 7) || 7));

const QUERY = `
  query Traffic($zone: String!, $since: Time!, $until: Time!) {
    viewer {
      zones(filter: { zoneTag: $zone }) {
        httpRequestsAdaptiveGroups(
          limit: 100
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          avg { sampleInterval }
          sum { edgeResponseBytes }
          dimensions { clientRequestHTTPHost }
        }
      }
    }
  }`;

// One 24h slice. Returns the adaptive groups, or null on any failure (network, retention, range) so
// callers can distinguish "all slices failed" (real error) from "this day had no/expired data".
async function queryDay(
  token: string,
  zone: string,
  since: Date,
  until: Date,
): Promise<AdaptiveGroup[] | null> {
  try {
    const res = await fetch(CF_GRAPHQL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: { zone, since: since.toISOString(), until: until.toISOString() },
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as GraphQLResponse;
    if (json.errors?.length) return null;
    const groups = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
    return Array.isArray(groups) ? groups : null;
  } catch {
    return null;
  }
}

export async function readTraffic(): Promise<TrafficReport> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const base = { windowDays: WINDOW_DAYS, byHost: {} as Record<string, HostTraffic> };
  if (!token || !zone) return { configured: false, error: false, ...base };

  const now = Date.now();
  const slices = Array.from({ length: WINDOW_DAYS }, (_, i) => ({
    since: new Date(now - (i + 1) * DAY_MS),
    until: new Date(now - i * DAY_MS),
  }));
  const days = await Promise.all(slices.map((s) => queryDay(token, zone, s.since, s.until)));

  // Every slice failed => a real error (bad token/zone/network), not just empty traffic.
  if (days.every((d) => d === null)) return { configured: true, error: true, ...base };

  const totals: Record<string, { requests: number; bytes: number }> = {};
  for (const groups of days) {
    if (!groups) continue;
    for (const g of groups) {
      const host = g.dimensions?.clientRequestHTTPHost;
      if (!host) continue;
      const sample = g.avg?.sampleInterval ?? 1;
      const acc = (totals[host] ??= { requests: 0, bytes: 0 });
      acc.requests += (g.count ?? 0) * sample;
      acc.bytes += (g.sum?.edgeResponseBytes ?? 0) * sample;
    }
  }

  const byHost: Record<string, HostTraffic> = {};
  for (const [host, t] of Object.entries(totals)) {
    byHost[host] = { requests: Math.round(t.requests), bytes: Math.round(t.bytes) };
  }
  return { configured: true, error: false, windowDays: WINDOW_DAYS, byHost };
}
