import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileRemoteConfigSource } from '../../src/node/file-source.ts';
import {
  CATALOG,
  FirebaseRemoteConfigAdapter,
  StaticRemoteConfigSource,
  buildConfigValues,
  resolvePlanLimit,
} from '../../src/remote-config/index.ts';
import type { FirebaseRemoteConfigTemplate } from '../../src/remote-config/index.ts';
import { testApi } from '../support/api.ts';

describe('remote-config', () => {
  describe('StaticRemoteConfigSource', () => {
    it('returns compiled-in defaults for local audience', async () => {
      const source = new StaticRemoteConfigSource();
      const doc = await source.getConfig('local');

      expect(doc.version).toBe(1);
      expect(doc.ttlSeconds).toBe(3600);
      expect(doc.audience).toBe('local');
      expect(doc.values['plans.free.events']?.value).toBe(10);
      expect(doc.values['plans.free.events']?.delivery).toBe('background');
      expect(doc.values['media.photo_max_bytes']?.value).toBe(1572864);
      expect(doc.values['signin.suggest_event_count']?.value).toBe(3);
    });

    it('merges key overrides and audience overrides', async () => {
      const source = new StaticRemoteConfigSource({
        overrides: {
          'plans.free.events': 25,
          custom_flag: { value: true, delivery: 'blocking' },
        },
        audienceOverrides: {
          user_vip: {
            'plans.free.events': 50,
          },
        },
      });

      const localDoc = await source.getConfig('local');
      expect(localDoc.values['plans.free.events']?.value).toBe(25);
      expect(localDoc.values['custom_flag']?.value).toBe(true);
      expect(localDoc.values['custom_flag']?.delivery).toBe('blocking');

      const vipDoc = await source.getConfig('user_vip');
      expect(vipDoc.values['plans.free.events']?.value).toBe(50);
      expect(vipDoc.values['custom_flag']?.value).toBe(true);
    });
  });

  describe('FileRemoteConfigSource', () => {
    it('loads and reloads configuration from disk', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'dtm-rc-'));
      const filePath = join(dir, 'config.json');

      try {
        writeFileSync(
          filePath,
          JSON.stringify({
            version: 3,
            ttlSeconds: 1800,
            values: {
              'plans.free.events': { value: 20, delivery: 'background' },
            },
            audiences: {
              beta_user: {
                'plans.free.events': { value: 30, delivery: 'background' },
              },
            },
          }),
        );

        const source = new FileRemoteConfigSource(filePath, { autoWatch: false });
        const localDoc = await source.getConfig('local');
        expect(localDoc.version).toBe(3);
        expect(localDoc.ttlSeconds).toBe(1800);
        expect(localDoc.values['plans.free.events']?.value).toBe(20);

        const betaDoc = await source.getConfig('beta_user');
        expect(betaDoc.values['plans.free.events']?.value).toBe(30);

        // Update file content and reload
        writeFileSync(
          filePath,
          JSON.stringify({
            version: 4,
            ttlSeconds: 600,
            values: {
              'plans.free.events': 40,
            },
          }),
        );

        source.reload();
        const updatedDoc = await source.getConfig('local');
        expect(updatedDoc.version).toBe(4);
        expect(updatedDoc.ttlSeconds).toBe(600);
        expect(updatedDoc.values['plans.free.events']?.value).toBe(40);

        source.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('FirebaseRemoteConfigAdapter', () => {
    it('Third-party provider: maps Firebase template, types, defaults, and audience conditions', async () => {
      const template: FirebaseRemoteConfigTemplate = {
        parameters: {
          'plans.free.events': {
            defaultValue: { value: '20' },
            conditionalValues: {
              vip_account: { value: '100' },
            },
            description: 'Free event limit',
          },
          plans_free_photos: {
            defaultValue: { value: '15' },
          },
          maintenance_mode: {
            defaultValue: { value: 'true' },
            description: 'delivery:blocking',
          },
          complex_flag: {
            defaultValue: { value: JSON.stringify({ value: 'special', delivery: 'blocking' }) },
          },
          invalid_limit: {
            defaultValue: { value: '-10' },
          },
        },
        version: { versionNumber: '12' },
      };

      const adapter = new FirebaseRemoteConfigAdapter(template, { ttlSeconds: 900 });

      // Local audience
      const localDoc = await adapter.getConfig('local');
      expect(localDoc.version).toBe(12);
      expect(localDoc.ttlSeconds).toBe(900);
      expect(localDoc.values['plans.free.events']?.value).toBe(20);
      expect(localDoc.values['plans.free.photos']?.value).toBe(15); // mapped from plans_free_photos
      expect(localDoc.values['maintenance_mode']?.value).toBe(true);
      expect(localDoc.values['maintenance_mode']?.delivery).toBe('blocking');
      expect(localDoc.values['complex_flag']?.value).toBe('special');
      expect(localDoc.values['complex_flag']?.delivery).toBe('blocking');

      // Conditional audience
      const vipDoc = await adapter.getConfig('vip_account');
      expect(vipDoc.values['plans.free.events']?.value).toBe(100);
    });
  });

  describe('Range validation and safe fallbacks', () => {
    it('Out-of-range value falls back to compiled-in default', () => {
      const values = buildConfigValues({
        'plans.free.events': -5,
        'media.photo_max_bytes': 10, // too small (< 1024)
        'signin.suggest_event_count': 5000, // too large (> 1000)
      });

      expect(values['plans.free.events']?.value).toBe(CATALOG['plans.free.events']?.defaultValue);
      expect(values['media.photo_max_bytes']?.value).toBe(CATALOG['media.photo_max_bytes']?.defaultValue);
      expect(values['signin.suggest_event_count']?.value).toBe(CATALOG['signin.suggest_event_count']?.defaultValue);
    });

    it('missing key falls back to compiled-in default', () => {
      const values = buildConfigValues({});
      expect(values['plans.free.events']?.value).toBe(10);
      expect(values['plans.premium.events']?.value).toBe(500);
      expect(values['media.photo_max_bytes']?.value).toBe(1572864);
    });
  });

  describe('HTTP GET /api/v1/remote-config', () => {
    it('Local audience: returns local audience with public cache headers and ETag without credentials', async () => {
      const api = await testApi();
      const res = await api.call<{ version: number; ttlSeconds: number; audience: string; values: Record<string, unknown> }>(
        'GET',
        'remote-config',
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(res.headers.get('ETag')).toMatch(/^"[a-f0-9]{32}"$/);
      expect(res.body.audience).toBe('local');
      expect(res.body.version).toBe(1);
      expect(res.body.ttlSeconds).toBe(3600);
      expect(res.body.values['plans.free.events']).toBeDefined();
    });

    it('Signed-in audience: returns audience matching authenticated account', async () => {
      const api = await testApi();
      const { token, accountId } = await api.google('user-signed-in');

      const res = await api.call<{ audience: string }>('GET', 'remote-config', { token });
      expect(res.status).toBe(200);
      expect(res.body.audience).toBe(accountId);
    });

    it('Matching user: token with matching ?user=<accountId> returns account audience', async () => {
      const api = await testApi();
      const { token, accountId } = await api.google('user-matching');

      const res = await api.call<{ audience: string }>('GET', `remote-config?user=${accountId}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.audience).toBe(accountId);
    });

    it("Someone else's user id: without matching token strictly falls back to local audience", async () => {
      const api = await testApi();
      const res = await api.call<{ audience: string }>('GET', 'remote-config?user=some-other-user-id');
      expect(res.status).toBe(200);
      expect(res.body.audience).toBe('local');
    });

    it('Mismatched user with token: authenticated user passing someone else user param falls back to local', async () => {
      const api = await testApi();
      const { token } = await api.google('user-mismatch');

      const res = await api.call<{ audience: string }>('GET', 'remote-config?user=another-account-id', { token });
      expect(res.status).toBe(200);
      expect(res.body.audience).toBe('local');
    });

    it('?user=local returns local audience even when authenticated', async () => {
      const api = await testApi();
      const { token } = await api.google('user-explicit-local');

      const res = await api.call<{ audience: string }>('GET', 'remote-config?user=local', { token });
      expect(res.status).toBe(200);
      expect(res.body.audience).toBe('local');
    });

    it('ETag and 304: returns 304 Not Modified when If-None-Match matches', async () => {
      const api = await testApi();
      const first = await api.call('GET', 'remote-config');
      expect(first.status).toBe(200);
      const etag = first.headers.get('ETag') as string;
      expect(etag).toBeDefined();

      const second = await api.call('GET', 'remote-config', {
        headers: { 'If-None-Match': etag },
      });
      expect(second.status).toBe(304);
      expect(second.headers.get('ETag')).toBe(etag);
      expect(second.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(second.body).toBeNull();

      const third = await api.call('GET', 'remote-config', {
        headers: { 'If-None-Match': '"stale-etag-value"' },
      });
      expect(third.status).toBe(200);
    });
  });

  describe('Dynamic plan enforcement in sync', () => {
    const THEME = { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' };

    it('Limit raised: raising Free event limit allows creating beyond default limit', async () => {
      // Remote config raises free limit from 10 to 12
      const remoteConfig = new StaticRemoteConfigSource({
        'plans.free.events': 12,
      });
      const api = await testApi({ remoteConfig });
      const { token } = await api.google('user-limit-raised');

      // Create 10 events (which would fill the default limit)
      for (let i = 1; i <= 10; i++) {
        const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
        const res = await api.call('PUT', `events/${id}`, {
          token,
          body: { title: `Event ${i}`, targetDate: '2026-12-31', theme: THEME },
        });
        expect(res.status).toBe(201);
      }

      // 11th event succeeds because limit was raised to 12
      const res11 = await api.call('PUT', 'events/00000000-0000-4000-8000-000000000011', {
        token,
        body: { title: 'Event 11', targetDate: '2026-12-31', theme: THEME },
      });
      expect(res11.status).toBe(201);

      // 12th event succeeds
      const res12 = await api.call('PUT', 'events/00000000-0000-4000-8000-000000000012', {
        token,
        body: { title: 'Event 12', targetDate: '2026-12-31', theme: THEME },
      });
      expect(res12.status).toBe(201);

      // 13th event exceeds the raised limit (12), returns 402 premium_required
      const res13 = await api.call<{ error: { code: string; details: { feature: string } } }>(
        'PUT',
        'events/00000000-0000-4000-8000-000000000013',
        {
          token,
          body: { title: 'Event 13', targetDate: '2026-12-31', theme: THEME },
        },
      );
      expect(res13.status).toBe(402);
      expect(res13.body.error.code).toBe('premium_required');
      expect(res13.body.error.details.feature).toBe('events');
    });

    it('Out-of-range value falls back to compiled-in limit during sync enforcement', async () => {
      // Remote config sets out-of-range value -5
      const remoteConfig = new StaticRemoteConfigSource({
        'plans.free.events': -5,
      });
      const api = await testApi({ remoteConfig });
      const { token } = await api.google('user-out-of-range');

      // Create 10 events (compiled-in default limit)
      for (let i = 1; i <= 10; i++) {
        const id = `00000000-0000-4000-8001-${String(i).padStart(12, '0')}`;
        const res = await api.call('PUT', `events/${id}`, {
          token,
          body: { title: `Event ${i}`, targetDate: '2026-12-31', theme: THEME },
        });
        expect(res.status).toBe(201);
      }

      // 11th event fails with 402 because -5 safely fell back to default 10
      const res11 = await api.call<{ error: { code: string } }>(
        'PUT',
        'events/00000000-0000-4000-8001-000000000011',
        {
          token,
          body: { title: 'Event 11', targetDate: '2026-12-31', theme: THEME },
        },
      );
      expect(res11.status).toBe(402);
      expect(res11.body.error.code).toBe('premium_required');
    });

    it('batch creation enforces active remote configuration limits', async () => {
      const remoteConfig = new StaticRemoteConfigSource({
        'plans.free.events': 12,
      });
      const api = await testApi({ remoteConfig });
      const { token } = await api.google('user-batch-remote-config');

      const events = Array.from({ length: 13 }, (_, i) => ({
        id: `00000000-0000-4000-8002-${String(i + 1).padStart(12, '0')}`,
        title: `Batch event ${i + 1}`,
        targetDate: '2026-12-31',
        theme: THEME,
      }));

      const res = await api.call<{
        results: Array<{ id: string; status: string; error?: { code: string } }>;
      }>('POST', 'events/batch', {
        token,
        body: { events },
      });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(13);

      // First 12 created
      for (let i = 0; i < 12; i++) {
        expect(res.body.results[i]?.status).toBe('created');
      }

      // 13th fails due to limit
      expect(res.body.results[12]?.status).toBe('error');
      expect(res.body.results[12]?.error?.code).toBe('premium_required');
    });

    it('resolvePlanLimit helper correctly parses and falls back', () => {
      expect(resolvePlanLimit(null, 'free', 'events')).toBe(10);
      expect(resolvePlanLimit(undefined, 'premium', 'events')).toBe(500);

      // Valid doc
      const doc = {
        version: 1,
        ttlSeconds: 3600,
        audience: 'local',
        values: {
          'plans.free.events': { value: 35, delivery: 'background' as const },
          'plans.premium.events': { value: null, delivery: 'background' as const },
          'plans.free.photos': { value: -5, delivery: 'background' as const }, // out of range
        },
      };

      expect(resolvePlanLimit(doc, 'free', 'events')).toBe(35);
      expect(resolvePlanLimit(doc, 'premium', 'events')).toBeNull();
      expect(resolvePlanLimit(doc, 'free', 'photos')).toBe(5); // fallback to default
    });
  });
});
