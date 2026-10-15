import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/ports/config.ts';
import type { Env } from '../../src/ports/config.ts';

const BASE: Env = {
  ORIGIN: 'https://dtm.example',
  LIVE_MODE: 'ws',
  RATE_SALT: 'salt',
  EMAIL_CODE_KEY: 'email-key',
  INVITE_KEY: 'invite-key',
};

function error(env: Env): string {
  try {
    loadConfig(env);
    return 'loaded';
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as Error).message;
  }
}

describe('loadConfig', () => {
  it('fills defaults', () => {
    expect(loadConfig(BASE)).toEqual({
      region: 'global',
      origin: 'https://dtm.example',
      mediaOrigin: 'https://dtm.example',
      version: 'dev',
      live: 'ws',
      signIn: [],
      stores: [],
      features: { spotify: false },
      ui: { memoBadge: 'top-right' },
      maintenance: false,
      inactiveJob: true,
      secrets: { rateSalt: 'salt', emailCodeKey: 'email-key', inviteKey: 'invite-key', adminToken: null },
    });
  });

  it('reads every setting', () => {
    const c = loadConfig({
      ...BASE, REGION: 'cn', MEDIA_ORIGIN: 'https://media.dtm.example/', VERSION: '1.2.3', LIVE_MODE: 'poll',
      SIGN_IN: 'email, apple,email', STORES: 'google', FEATURE_SPOTIFY: '1', UI_MEMO_BADGE: 'top-left', MAINTENANCE: '1',
      INACTIVE_JOB: '0', ADMIN_TOKEN: 'a'.repeat(32),
    });
    expect([c.region, c.mediaOrigin, c.version, c.live, c.signIn, c.stores]).toEqual(['cn', 'https://media.dtm.example', '1.2.3', 'poll', ['email', 'apple'], ['google']]);
    expect([c.features.spotify, c.ui.memoBadge, c.maintenance, c.inactiveJob, c.secrets.adminToken]).toEqual([true, 'top-left', true, false, 'a'.repeat(32)]);
  });

  it('refuses to start without the secrets (BACKEND.md section 11)', () => {
    for (const name of ['RATE_SALT', 'EMAIL_CODE_KEY', 'INVITE_KEY']) {
      expect(error({ ...BASE, [name]: undefined })).toBe(`${name} is required`);
      expect(error({ ...BASE, [name]: '  ' })).toBe(`${name} is required`);
    }
  });

  it('refuses bad values and never echoes them', () => {
    expect(error({ ...BASE, ORIGIN: undefined })).toBe('ORIGIN is required');
    expect(error({ ...BASE, ORIGIN: 'http://dtm.example' })).toBe('ORIGIN must be an https origin');
    expect(error({ ...BASE, ORIGIN: 'https://dtm.example/path' })).toBe('ORIGIN must be an https origin');
    expect(error({ ...BASE, ORIGIN: 'not a url' })).toBe('ORIGIN must be an https origin');
    expect(error({ ...BASE, LIVE_MODE: 'sse' })).toBe('LIVE_MODE must be ws or poll');
    expect(error({ ...BASE, SIGN_IN: 'apple,facebook' })).toBe('SIGN_IN has an unknown value');
    expect(error({ ...BASE, MAINTENANCE: 'yes' })).toBe('MAINTENANCE must be 0 or 1');
    expect(error({ ...BASE, UI_MEMO_BADGE: 'bottom' })).toBe('UI_MEMO_BADGE must be top-left or top-right');
    expect(error({ ...BASE, ADMIN_TOKEN: 'short-secret-value' })).toBe('ADMIN_TOKEN must be at least 32 characters');
  });

  it('allows plain http on localhost for local runs', () => {
    expect(loadConfig({ ...BASE, ORIGIN: 'http://localhost:8787' }).origin).toBe('http://localhost:8787');
  });
});
