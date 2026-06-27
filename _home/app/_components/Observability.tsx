'use client';

import { useEffect, useState } from 'react';
import type { ObservabilityData } from '@/lib/observability';

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

// Skeleton shown while the widget fetches /api/observability — keeps the home page instant and
// the slow Cloudflare Analytics calls off the SSR critical path.
function Skeleton() {
  return (
    <div className="obs-loading" aria-busy="true" aria-label="Loading observability">
      <div className="obs-health">
        {[0, 1, 2, 3, 4].map((i) => (
          <span className="obs-pill obs-skel" key={i}>
            <span className="obs-skel-bar" style={{ width: 52 }} />
          </span>
        ))}
      </div>
      <div className="obs-traffic">
        <div className="obs-traffic-head">
          <span className="obs-skel-bar" style={{ width: 96 }} />
        </div>
        <div className="obs-row">
          <span className="obs-skel-bar" style={{ width: 90 }} />
          <span className="obs-skel-bar" style={{ width: 60 }} />
        </div>
      </div>
    </div>
  );
}

// Dashboard observability: a service-health strip + per-experiment public traffic from Cloudflare.
// Fetched client-side (see /api/observability). See CLAUDE.md ("Observability").
export function Observability() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Trailing slash: _home sets trailingSlash, so this avoids a 308 redirect hop.
    fetch('/api/observability/')
      .then((r) => (r.ok ? (r.json() as Promise<ObservabilityData>) : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const upCount = data ? data.health.filter((s) => s.active).length : 0;

  return (
    <section className="obs" aria-label="Observability">
      <div className="section-head">
        <h2>Observability</h2>
        {data && (
          <span className="count">
            {upCount}/{data.health.length} up
          </span>
        )}
      </div>

      {!data ? (
        failed ? (
          <p className="obs-hint">Couldn’t load observability right now.</p>
        ) : (
          <Skeleton />
        )
      ) : (
        <>
          <div className="obs-health">
            {data.health.map((s) => (
              <span className={`obs-pill ${s.active ? 'is-up' : 'is-down'}`} key={s.unit}>
                <span className="obs-dot" aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </div>

          {data.publicExperiments.length > 0 && (
            <div className="obs-traffic">
              <div className="obs-traffic-head">
                <span>Public traffic</span>
                <span className="obs-window">last {data.traffic.windowDays}d</span>
              </div>
              {!data.traffic.configured ? (
                <p className="obs-hint">
                  Add a Cloudflare API token to{' '}
                  <code>~/.config/claude-experiments/cloudflare.env</code> to see hits.
                </p>
              ) : data.traffic.error ? (
                <p className="obs-hint">Couldn’t reach Cloudflare Analytics right now.</p>
              ) : (
                data.publicExperiments.map((e) => {
                  const t = data.traffic.byHost[e.host];
                  return (
                    <a className="obs-row" href={`https://${e.host}/`} key={e.slug}>
                      <span className="obs-row-name">{e.slug}</span>
                      <span className="obs-row-val">
                        {t ? `${fmtNum(t.requests)} hits` : '—'}
                        {t && t.bytes > 0 && (
                          <span className="obs-row-sub"> · {fmtBytes(t.bytes)}</span>
                        )}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
