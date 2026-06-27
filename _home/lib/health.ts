// Service-health for the dashboard: queries `systemctl --user is-active` for the infra services
// and each experiment that runs as a long-lived unit. Read at request time (force-dynamic). Silent
// degradation — a unit that can't be queried just reads as down, matching the other dashboard libs.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readExperiments } from './registry';

const execFileAsync = promisify(execFile);

export type ServiceStatus = {
  unit: string; // systemd unit name (without .service)
  label: string; // short human label
  active: boolean;
};

async function isActive(unit: string): Promise<boolean> {
  try {
    // `is-active` prints "active" + exit 0 when up; otherwise non-zero (execFile throws).
    const { stdout } = await execFileAsync('systemctl', ['--user', 'is-active', `${unit}.service`]);
    return stdout.trim() === 'active';
  } catch {
    return false;
  }
}

export async function readServiceHealth(): Promise<ServiceStatus[]> {
  const experiments = await readExperiments();
  // Infra first (the public path depends on these), then each experiment with its own service.
  // Static apps have no service of their own — Caddy file-serves them — so they're omitted here.
  // Each entry lists candidate unit names; the service is "up" if ANY candidate is active.
  // claude-os unit naming isn't uniform: services are `exp-<slug>` (bookshelf, ideas, sketchpad)
  // while experiments are `cos-<slug>` (frog-tour, knight-moves) — so check both. The dashboard
  // itself runs as `claudeos-home`.
  const entries: Array<{ units: string[]; label: string }> = [
    { units: ['cloudflared'], label: 'Tunnel' },
    { units: ['caddy-experiments'], label: 'Caddy' },
    { units: ['claudeos-home'], label: 'Dashboard' },
    ...experiments
      .filter((e) => e.type !== 'static')
      .map((e) => ({ units: [`exp-${e.slug}`, `cos-${e.slug}`], label: e.slug })),
  ];

  return Promise.all(
    entries.map(async ({ units, label }) => {
      const results = await Promise.all(units.map(isActive));
      const idx = results.findIndex(Boolean);
      return { unit: idx >= 0 ? units[idx] : units[0], label, active: idx >= 0 };
    }),
  );
}
