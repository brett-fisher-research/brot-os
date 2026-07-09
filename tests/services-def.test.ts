import { describe, expect, it } from 'vitest';
import {
  InvalidShapeError,
  InvalidTypeError,
  MissingFieldError,
  UnknownKeyError,
  parseServiceDefs,
} from '../bin/services/def.js';

const HOME = '/home/testuser';

describe('parseServiceDefs — shapes', () => {
  it('a single def object normalizes to a one-element array', () => {
    const out = parseServiceDefs({ name: 'bookshelf', cmd: 'node server.js', port: 3010 }, HOME);
    expect(out).toEqual([{ name: 'bookshelf', cmd: 'node server.js', port: 3010 }]);
  });

  it('an array of defs normalizes each entry (multi-app repos)', () => {
    const out = parseServiceDefs(
      [
        { name: 'frog-tour', cmd: 'npm run start', cwd: 'frog-tour', port: 3020 },
        { name: 'knight-moves', cmd: 'npm run start', cwd: 'knight-moves', port: 3021 },
      ],
      HOME,
    );
    expect(out.map((d) => d.name)).toEqual(['frog-tour', 'knight-moves']);
    expect(out[1]).toEqual({ name: 'knight-moves', cmd: 'npm run start', cwd: 'knight-moves', port: 3021 });
  });

  it('rejects non-object values with InvalidShapeError', () => {
    expect(() => parseServiceDefs('nope', HOME)).toThrow(InvalidShapeError);
    expect(() => parseServiceDefs(null, HOME)).toThrow(InvalidShapeError);
    expect(() => parseServiceDefs([], HOME)).toThrow(InvalidShapeError);
    expect(() => parseServiceDefs([42], HOME)).toThrow(InvalidShapeError);
  });
});

describe('parseServiceDefs — required fields and unknown keys', () => {
  it('missing cmd rejects with MissingFieldError', () => {
    expect(() => parseServiceDefs({ name: 'x' }, HOME)).toThrow(MissingFieldError);
    try {
      parseServiceDefs({ name: 'x' }, HOME);
    } catch (e) {
      expect((e as MissingFieldError).field).toBe('cmd');
    }
  });

  it('missing name rejects with MissingFieldError', () => {
    expect(() => parseServiceDefs({ cmd: 'node x.js' }, HOME)).toThrow(MissingFieldError);
  });

  it('unknown key rejects with UnknownKeyError naming the key', () => {
    expect(() => parseServiceDefs({ name: 'x', cmd: 'y', caddyfile: 'z' }, HOME)).toThrow(UnknownKeyError);
    try {
      parseServiceDefs({ name: 'x', cmd: 'y', caddyfile: 'z' }, HOME);
    } catch (e) {
      expect((e as UnknownKeyError).key).toBe('caddyfile');
    }
  });

  it('one bad entry rejects the whole array', () => {
    expect(() =>
      parseServiceDefs([{ name: 'ok', cmd: 'node a.js' }, { name: 'bad' }], HOME),
    ).toThrow(MissingFieldError);
  });
});

describe('parseServiceDefs — field types', () => {
  it('rejects wrong types with InvalidTypeError', () => {
    expect(() => parseServiceDefs({ name: 'x', cmd: 42 }, HOME)).toThrow(InvalidTypeError);
    expect(() => parseServiceDefs({ name: 'x', cmd: 'y', port: '3000' }, HOME)).toThrow(InvalidTypeError);
    expect(() => parseServiceDefs({ name: 'x', cmd: 'y', env: { A: 1 } }, HOME)).toThrow(InvalidTypeError);
    expect(() => parseServiceDefs({ name: 'x', cmd: 'y', envFile: [1] }, HOME)).toThrow(InvalidTypeError);
    expect(() => parseServiceDefs({ name: '', cmd: 'y' }, HOME)).toThrow(InvalidTypeError);
  });
});

describe('parseServiceDefs — normalization', () => {
  it('expands ~ at the start of cmd path arguments', () => {
    const [def] = parseServiceDefs(
      { name: 'x', cmd: 'node ~/bin/serve.js --root ~/www --port 8080' },
      HOME,
    );
    expect(def.cmd).toBe(`node ${HOME}/bin/serve.js --root ${HOME}/www --port 8080`);
  });

  it('leaves ~ alone mid-token', () => {
    const [def] = parseServiceDefs({ name: 'x', cmd: 'echo a~b --opt=~/y' }, HOME);
    expect(def.cmd).toBe('echo a~b --opt=~/y');
  });

  it('normalizes envFile to an array and expands ~ paths', () => {
    const [single] = parseServiceDefs({ name: 'x', cmd: 'y', envFile: '~/config/.env' }, HOME);
    expect(single.envFile).toEqual([`${HOME}/config/.env`]);

    const [multi] = parseServiceDefs(
      { name: 'x', cmd: 'y', envFile: ['~/a.env', 'config/b.env'] },
      HOME,
    );
    expect(multi.envFile).toEqual([`${HOME}/a.env`, 'config/b.env']);
  });

  it('env and cwd pass through untouched', () => {
    const [def] = parseServiceDefs(
      { name: 'x', cmd: 'y', cwd: 'apps/web', env: { PORT: '3000' } },
      HOME,
    );
    expect(def.cwd).toBe('apps/web');
    expect(def.env).toEqual({ PORT: '3000' });
  });
});
