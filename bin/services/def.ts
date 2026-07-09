// brot.service.json — the generic service-definition standard.
//
// A tenant repo declares HOW its long-running service runs by placing a
// `brot.service.json` at its repo root. The file holds ONE def object, or an
// array of defs for multi-app repos. Keys are generic only — nothing
// caddy/cloudflare/systemd-specific belongs here; host-specific wiring lives
// in `.brot/services.local.json` (see discover.ts).
//
// Schema per def:
//   name     string                  required — unique service name
//   cmd      string                  required — command line to run
//   cwd      string                  optional — working dir, repo-root-relative
//   env      Record<string, string>  optional — extra environment
//   envFile  string | string[]       optional — dotenv file(s); normalized to string[]
//   port     number                  optional — display metadata only
//
// Normalization: `~` at the start of a cmd path argument or an envFile path
// expands to the user's home dir. Unknown keys and missing name/cmd reject
// with named, testable errors (instanceof checks).

import { homedir } from 'node:os';

export interface ServiceDef {
  name: string;
  cmd: string;
  cwd?: string;
  env?: Record<string, string>;
  envFile?: string[];
  port?: number;
}

export class ServiceDefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MissingFieldError extends ServiceDefError {
  constructor(public readonly field: 'name' | 'cmd') {
    super(`service def is missing required field "${field}"`);
  }
}

export class UnknownKeyError extends ServiceDefError {
  constructor(public readonly key: string) {
    super(`service def has unknown key "${key}"`);
  }
}

export class InvalidTypeError extends ServiceDefError {
  constructor(public readonly field: string, expected: string) {
    super(`service def field "${field}" must be ${expected}`);
  }
}

export class InvalidShapeError extends ServiceDefError {
  constructor(detail: string) {
    super(`brot.service.json must hold one def object or an array of defs (${detail})`);
  }
}

const KNOWN_KEYS = new Set(['name', 'cmd', 'cwd', 'env', 'envFile', 'port']);

// Expand a leading `~` on one path: `~` alone or `~/...`. `~user` forms pass through.
function expandTilde(p: string, home: string): string {
  if (p === '~') return home;
  if (p.startsWith('~/')) return home + p.slice(1);
  return p;
}

// Expand `~` at the start of each whitespace-delimited cmd token.
function expandCmd(cmd: string, home: string): string {
  return cmd.replace(/(^|\s)(~(?:\/\S*)?)(?=\s|$)/g, (_m, pre: string, tok: string) => pre + expandTilde(tok, home));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseOne(raw: unknown, home: string): ServiceDef {
  if (!isPlainObject(raw)) throw new InvalidShapeError('entry is not an object');
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) throw new UnknownKeyError(key);
  }
  const { name, cmd, cwd, env, envFile, port } = raw;

  if (name === undefined) throw new MissingFieldError('name');
  if (typeof name !== 'string' || name === '') throw new InvalidTypeError('name', 'a non-empty string');
  if (cmd === undefined) throw new MissingFieldError('cmd');
  if (typeof cmd !== 'string' || cmd === '') throw new InvalidTypeError('cmd', 'a non-empty string');

  const def: ServiceDef = { name, cmd: expandCmd(cmd, home) };

  if (cwd !== undefined) {
    if (typeof cwd !== 'string') throw new InvalidTypeError('cwd', 'a string');
    def.cwd = cwd;
  }
  if (env !== undefined) {
    if (!isPlainObject(env) || Object.values(env).some((v) => typeof v !== 'string')) {
      throw new InvalidTypeError('env', 'an object of string values');
    }
    def.env = env as Record<string, string>;
  }
  if (envFile !== undefined) {
    const files = Array.isArray(envFile) ? envFile : [envFile];
    if (files.some((f) => typeof f !== 'string')) {
      throw new InvalidTypeError('envFile', 'a string or array of strings');
    }
    def.envFile = (files as string[]).map((f) => expandTilde(f, home));
  }
  if (port !== undefined) {
    if (typeof port !== 'number' || !Number.isInteger(port)) {
      throw new InvalidTypeError('port', 'an integer');
    }
    def.port = port;
  }
  return def;
}

// Parse the parsed-JSON value of a brot.service.json: one def or an array of defs.
// Always returns an array. `home` is overridable for tests.
export function parseServiceDefs(value: unknown, home: string = homedir()): ServiceDef[] {
  if (Array.isArray(value)) {
    if (value.length === 0) throw new InvalidShapeError('array is empty');
    return value.map((entry) => parseOne(entry, home));
  }
  if (isPlainObject(value)) return [parseOne(value, home)];
  throw new InvalidShapeError(`got ${value === null ? 'null' : typeof value}`);
}
