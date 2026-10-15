// Guards of the first sign-in upload allowance (BACKEND.md section 8, coordinator decision): only with
// the flag, on a session younger than 24 hours, for events created before the session, at most 500
// per session, and marked in events.first_upload_at.
import { describe, expect, it } from 'vitest';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import { testApi } from '../support/api.ts';
import type { Api } from '../support/api.ts';

const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' } };
const uuid = (n: number): string => `0b8f3c1e-6d0a-4a51-9f61-${String(n).padStart(12, '0')}`;
const DAY_MS = 86_400_000;
type ErrorBody = { error: { code: string; message: string; details: unknown } };

describe('first sign-in upload guards', () => {
  async function full(a: Api) {
    const account = await a.google('owner-sub');
    for (let n = 1; n <= 10; n++) await a.call('PUT', `events/${uuid(n)}`, { token: account.token, body: DOC });
    a.ports.clock.advance(60_000);
    return a.google('owner-sub');
  }

  it('the flag is ignored on a session older than 24 hours', async () => {
    const a = await testApi();
    const device = await full(a);
    a.ports.clock.advance(DAY_MS);
    const r = await a.call('PUT', `events/${uuid(20)}?firstUpload=1&createdAt=2026-10-01T10:00:00Z`, { token: device.token, body: DOC });
    expect(r.status).toBe(402);
  });

  it('the flag is ignored for an event created after the session started', async () => {
    const a = await testApi();
    const device = await full(a);
    const r = await a.call('PUT', `events/${uuid(20)}?firstUpload=1&createdAt=2026-10-12T16:00:00Z`, { token: device.token, body: DOC });
    expect(r.status).toBe(402);
    const bad = await a.call<ErrorBody>('PUT', `events/${uuid(20)}?firstUpload=1&createdAt=yesterday`, { token: device.token, body: DOC });
    expect([bad.status, bad.body.error.details]).toEqual([400, { field: 'createdAt' }]);
    expect((await a.call('PUT', `events/${uuid(20)}?firstUpload=0`, { token: device.token, body: DOC })).status).toBe(402);
  });

  it('the 501st first upload of a session is refused', async () => {
    const a = await testApi();
    const device = await full(a);
    for (let n = 101; n <= 600; n++) {
      const r = await a.call('PUT', `events/${uuid(n)}?firstUpload=1&createdAt=2026-10-01T10:00:00Z`, { token: device.token, body: DOC });
      if (r.status !== 201) throw new Error(`upload ${n - 100} refused: ${r.status}`);
    }
    const r = await a.call<ErrorBody>('PUT', `events/${uuid(601)}?firstUpload=1&createdAt=2026-10-01T10:00:00Z`, { token: device.token, body: DOC });
    expect([r.status, r.body.error.code]).toEqual([402, 'premium_required']);
  }, 60_000);

  it('first uploads are marked in events.first_upload_at', async () => {
    const { driver, store } = await openSqliteStore();
    const a = await testApi({ store });
    const device = await full(a);
    await a.call('PUT', `events/${uuid(20)}?firstUpload=1&createdAt=2026-10-01T10:00:00Z`, { token: device.token, body: DOC });
    const rows = await driver.query<{ id: string; first_upload_at: number | null }>('SELECT id, first_upload_at FROM events WHERE first_upload_at IS NOT NULL');
    expect(rows).toEqual([{ id: uuid(20), first_upload_at: 1_791_817_505 }]);
  });
});
