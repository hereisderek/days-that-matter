// Guards of POST /events/batch and POST /events/import (Task 12.1, BACKEND.md sections 7.3 and 8):
// batch: max 100 events, per-event errors (one invalid does not stop the others), plan limits enforced.
// import: max 500 events, 4 MB payload limit, atomic failure on invalid event or conflict, rate limiting (10 per hour).
import { describe, expect, it } from 'vitest';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import { resetImportRateLimitsForTesting } from '../../src/http/sync.ts';
import { testApi } from '../support/api.ts';

const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' } };
const uuid = (n: number): string => `0b8f3c1e-6d0a-4a51-9f61-${String(n).padStart(12, '0')}`;
type ErrorBody = { error: { code: string; message: string; details: unknown } };

describe('batch and import guards', () => {
  it('batch rejects more than 100 events', async () => {
    const a = await testApi();
    const account = await a.google('owner-sub');
    const events = Array.from({ length: 101 }, (_, i) => ({
      id: uuid(i + 1),
      ...DOC,
    }));
    const r = await a.call<ErrorBody>('POST', 'events/batch', { token: account.token, body: { events } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('invalid_payload');
    expect((r.body.error.details as Record<string, unknown>)?.['field']).toBe('events');
  });

  it('batch: invalid event does not block valid events in the batch', async () => {
    const a = await testApi();
    const account = await a.google('owner-sub');
    const events = [
      { id: uuid(1), ...DOC, title: 'Valid 1' },
      { id: uuid(2), ...DOC, title: '' }, // invalid
      { id: uuid(3), ...DOC, title: 'Valid 3' },
    ];
    const r = await a.call<{ results: { id: string; status: string; error?: unknown }[] }>('POST', 'events/batch', {
      token: account.token,
      body: { events },
    });
    expect(r.status).toBe(200);
    expect(r.body.results).toEqual([
      { id: uuid(1), status: 'created' },
      { id: uuid(2), status: 'error', error: expect.objectContaining({ code: 'invalid_payload' }) },
      { id: uuid(3), status: 'created' },
    ]);
    expect(await a.ports.store.getEvent(uuid(1))).not.toBeNull();
    expect(await a.ports.store.getEvent(uuid(2))).toBeNull();
    expect(await a.ports.store.getEvent(uuid(3))).not.toBeNull();
  });

  it('import rejects more than 500 events', async () => {
    const a = await testApi();
    const account = await a.google('owner-sub');
    const events = Array.from({ length: 501 }, (_, i) => ({
      id: uuid(i + 1),
      ...DOC,
    }));
    const r = await a.call<ErrorBody>('POST', 'events/import', { token: account.token, body: { events } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('invalid_payload');
    expect((r.body.error.details as Record<string, unknown>)?.['field']).toBe('events');
  });

  it('import is rate limited to 10 requests per hour per account', async () => {
    resetImportRateLimitsForTesting();
    const a = await testApi();
    const account = await a.google('owner-sub');
    for (let n = 1; n <= 10; n++) {
      const r = await a.call('POST', 'events/import', {
        token: account.token,
        body: { events: [{ id: uuid(n), ...DOC }] },
      });
      expect(r.status, `request ${n}`).toBe(200);
    }
    const r11 = await a.call<ErrorBody>('POST', 'events/import', {
      token: account.token,
      body: { events: [{ id: uuid(11), ...DOC }] },
    });
    expect(r11.status).toBe(429);
    expect(r11.body.error.code).toBe('rate_limited');
    expect(r11.headers.get('Retry-After')).toBeTruthy();

    a.ports.clock.advance(3_601_000);
    const rAfter = await a.call('POST', 'events/import', {
      token: account.token,
      body: { events: [{ id: uuid(11), ...DOC }] },
    });
    expect(rAfter.status).toBe(200);
  });

  it('imported events are marked with imported_at in SQLite', async () => {
    const { driver, store } = await openSqliteStore();
    const a = await testApi({ store });
    const account = await a.google('owner-sub');
    const r = await a.call('POST', 'events/import', {
      token: account.token,
      body: { events: [{ id: uuid(1), ...DOC }] },
    });
    expect(r.status).toBe(200);
    const rows = await driver.query<{ id: string; imported_at: number | null }>(
      'SELECT id, imported_at FROM events WHERE imported_at IS NOT NULL',
    );
    expect(rows).toEqual([{ id: uuid(1), imported_at: Math.floor(a.ports.clock.nowMs() / 1000) }]);
  });
});
