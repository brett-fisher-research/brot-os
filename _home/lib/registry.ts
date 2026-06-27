// Client for the standalone experiments-registry service. The /experiments page and the
// observability widget read the registry at request time (callers use `dynamic = 'force-dynamic'`)
// by fetching the service instead of reading registry.json in-process — the registry is its
// own service now.
//
// Base URL is env-configurable (the systemd unit sets REGISTRY_API); defaults to the localhost
// port the registry service binds to. GET /registry returns { experiments: { <slug>: {...} } } —
// the same shape registry.json had.
const REGISTRY_API = process.env.REGISTRY_API ?? 'http://127.0.0.1:4001';

export type Experiment = {
  slug: string;
  type: 'static' | 'next' | 'worker';
  port: number | null;
  repo: string;
  created: string;
  // Empty for workers — they're background processes with no URL.
  href: string;
  // True when published publicly at <slug>.brettfisher.dev via the Cloudflare Tunnel.
  public: boolean;
};

// Fetch the registry from the experiments-registry service. Degrades to [] on any failure
// (service down, bad response) so the dashboard never crashes when the registry is unavailable.
export async function readExperiments(): Promise<Experiment[]> {
  let parsed: {
    experiments?: Record<string, Omit<Experiment, 'slug' | 'href' | 'public'> & { public?: boolean }>;
  };
  try {
    const res = await fetch(`${REGISTRY_API}/registry`, { cache: 'no-store' });
    if (!res.ok) return [];
    parsed = (await res.json()) as typeof parsed;
  } catch {
    return [];
  }

  const experiments = parsed.experiments ?? {};
  return Object.entries(experiments)
    .map(([slug, v]) => ({
      slug,
      type: v.type,
      port: v.port ?? null,
      repo: v.repo,
      created: v.created,
      href: v.type === 'worker' ? '' : `/${slug}/`,
      public: v.public === true,
    }))
    .sort((a, b) => (a.created < b.created ? 1 : -1));
}
