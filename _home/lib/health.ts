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
  const units: Array<{ unit: string; label: string }> = [
    { unit: 'cloudflared', label: 'Tunnel' },
    { unit: 'caddy-experiments', label: 'Caddy' },
    { unit: 'exp-home', label: 'Dashboard' },
    ...experiments
      .filter((e) => e.type !== 'static')
      .map((e) => ({ unit: `exp-${e.slug}`, label: e.slug })),
  ];

  return Promise.all(
    units.map(async ({ unit, label }) => ({ unit, label, active: await isActive(unit) })),
  );
}
