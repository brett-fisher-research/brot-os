// Service discovery — the full known-service list for a host.
//
// Two sources merge:
//   1. Repo defs — scan the tenant container dirs (projects/, services/,
//      dotfiles/, packages/) directly under ROOT for repo-root
//      `brot.service.json` files. Source = the tenant's root-relative path
//      (e.g. "services/bookshelf").
//   2. Local defs — `.brot/services.local.json` (gitignored, per-host) with
//      shape { enabled: string[], defs?: Def[] }. Inline defs are the escape
//      hatch for host-local one-offs with no repo; source = "local".
//
// A service is enabled iff its name appears in `enabled`. A missing
// services.local.json means nothing enabled, no crash.
//
// ROOT resolves like bin/sync.mjs: BROT_SERVICES_ROOT env var, else the repo
// root relative to this file; a `root` param overrides both for test fixtures.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type ServiceDef, ServiceDefError, parseServiceDefs } from './def.js';

export const CONTAINERS = ['projects', 'services', 'dotfiles', 'packages'] as const;
export const DEF_FILE = 'brot.service.json';
export const LOCAL_FILE = join('.brot', 'services.local.json');

export interface KnownService {
  def: ServiceDef;
  source: string; // tenant path like "services/bookshelf", or "local"
  enabled: boolean;
}

export class LocalConfigError extends ServiceDefError {}

interface DiscoverOptions {
  root?: string;
  home?: string; // ~ expansion target, overridable for tests
}

function defaultRoot(): string {
  return resolve(
    process.env.BROT_SERVICES_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  );
}

function readDefFile(path: string, home?: string): ServiceDef[] {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ServiceDefError(`${path}: not valid JSON (${(e as Error).message})`);
  }
  try {
    return parseServiceDefs(value, home);
  } catch (e) {
    if (e instanceof ServiceDefError) e.message = `${path}: ${e.message}`;
    throw e;
  }
}

function readLocalConfig(path: string, home?: string): { enabled: Set<string>; defs: ServiceDef[] } {
  if (!existsSync(path)) return { enabled: new Set(), defs: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new LocalConfigError(`${path}: not valid JSON (${(e as Error).message})`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new LocalConfigError(`${path}: must be an object { enabled, defs? }`);
  }
  const { enabled, defs } = raw as { enabled?: unknown; defs?: unknown };
  if (!Array.isArray(enabled) || enabled.some((n) => typeof n !== 'string')) {
    throw new LocalConfigError(`${path}: "enabled" must be an array of service names`);
  }
  return {
    enabled: new Set(enabled as string[]),
    defs: defs === undefined ? [] : parseServiceDefs(defs, home),
  };
}

// The full known-service list: every repo def under the containers plus every
// inline local def, each tagged with its source and enabled flag.
export function discoverServices(opts: DiscoverOptions = {}): KnownService[] {
  const root = resolve(opts.root ?? defaultRoot());
  const local = readLocalConfig(join(root, LOCAL_FILE), opts.home);
  const services: KnownService[] = [];

  for (const container of CONTAINERS) {
    const dir = join(root, container);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const repo = join(dir, name);
      const defPath = join(repo, DEF_FILE);
      try {
        if (!statSync(repo).isDirectory() || !existsSync(defPath)) continue;
      } catch {
        continue; // vanished mid-scan
      }
      const source = `${container}/${name}`;
      for (const def of readDefFile(defPath, opts.home)) {
        services.push({ def, source, enabled: local.enabled.has(def.name) });
      }
    }
  }

  for (const def of local.defs) {
    services.push({ def, source: 'local', enabled: local.enabled.has(def.name) });
  }

  return services;
}
