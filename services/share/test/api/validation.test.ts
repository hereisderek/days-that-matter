import { describe, it, expect } from 'vitest';
import { INSTALL, body, call, validPayload } from './helpers';

const post = (b: unknown, headers: Record<string, string> = {}) =>
  call('POST', '/api/v1/shares', { body: b, headers: { 'X-Install-Id': INSTALL, ...headers } });
const cp = (...n: number[]) => String.fromCodePoint(...n);

async function expectStatus(res: Response, status: number, code?: string) {
  const text = await res.text();
  expect(res.status, text).toBe(status);
  if (code) expect(JSON.parse(text).error.code).toBe(code);
}

describe('payload validation: valid and boundary', () => {
  it('accepts the contract example', async () => expectStatus(await post(body()), 201));
  it('accepts minimal payload and fills defaults', async () => {
    const res = await post({
      schemaVersion: 1,
      payload: { v: 1, title: 'x', targetDate: '2030-01-01', theme: { paletteId: 'a', cardStyle: 'b', typography: 'c' } },
    });
    await expectStatus(res, 201);
  });
  it('accepts 100 char title and rejects 101', async () => {
    await expectStatus(await post(body({ payload: validPayload({ title: 'a'.repeat(100) }) })), 201);
    await expectStatus(await post(body({ payload: validPayload({ title: 'a'.repeat(101) }) })), 400, 'invalid_payload');
  });
  it('counts code points, not UTF-16 units', async () => {
    await expectStatus(await post(body({ payload: validPayload({ title: cp(0x1f600).repeat(100) }) })), 201);
  });
  it('rejects empty and whitespace-only title', async () => {
    await expectStatus(await post(body({ payload: validPayload({ title: '' }) })), 400);
    await expectStatus(await post(body({ payload: validPayload({ title: '   ' }) })), 400);
  });
  it('year boundaries 1900 and 2200 accepted, 1899 and 2201 rejected', async () => {
    for (const d of ['1900-01-01', '2200-12-31']) await expectStatus(await post(body({ payload: validPayload({ targetDate: d }) })), 201);
    for (const d of ['1899-12-31', '2201-01-01']) await expectStatus(await post(body({ payload: validPayload({ targetDate: d }) })), 400);
  });
  it('accepts leap day, rejects impossible dates', async () => {
    await expectStatus(await post(body({ payload: validPayload({ targetDate: '2028-02-29' }) })), 201);
    for (const d of ['2027-02-29', '2027-13-01', '2027-04-31', '2027-6-1', 'tomorrow']) {
      await expectStatus(await post(body({ payload: validPayload({ targetDate: d }) })), 400);
    }
  });
  it('targetTime format', async () => {
    await expectStatus(await post(body({ payload: validPayload({ targetTime: '23:59:59' }) })), 201);
    await expectStatus(await post(body({ payload: validPayload({ targetTime: null }) })), 201);
    for (const t of ['24:00:00', '12:60:00', '12:00', '1:00:00']) {
      await expectStatus(await post(body({ payload: validPayload({ targetTime: t }) })), 400);
    }
  });
  it('largest possible v1 payload stays under the 8192 byte cap', async () => {
    // Worst case: 100 four-byte code points in the title, longest ids and zone. The 8 KB check in
    // parseShareBody is a safety net for future schema versions and cannot be reached with v1.
    const { parseShareBody } = await import('../../src/lib/validate');
    const max = parseShareBody(
      body({
        payload: validPayload({
          title: String.fromCodePoint(0x1f600).repeat(100),
          timeZone: 'America/Argentina/ComodRivadavia',
          theme: { paletteId: 'a'.repeat(32), cardStyle: 'b'.repeat(32), typography: 'c'.repeat(32), gradient: ['#FFFFFF', '#000000'] },
        }),
      }),
    );
    expect(max.payloadBytes).toBeLessThan(8192);
  });
});

describe('payload validation: hostile input', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['unknown payload field', { extra: 1 }],
    ['memos', { memos: [] }],
    ['notes', { notes: 'hi' }],
    ['ownerId', { ownerId: 'u1' }],
    ['url field', { wallpaper: 'https://evil.test/x.png' }],
    ['NUL in title', { title: 'a' + cp(0) + 'b' }],
    ['C1 control in title', { title: 'a' + cp(0x85) + 'b' }],
    ['LS in title', { title: 'a' + cp(0x2028) + 'b' }],
    ['PS in title', { title: 'a' + cp(0x2029) + 'b' }],
    ['RLO in title', { title: 'a' + cp(0x202e) + 'b' }],
    ['bidi isolate in title', { title: 'a' + cp(0x2066) + 'b' }],
    ['lone high surrogate', { title: 'a' + String.fromCharCode(0xd800) + 'b' }],
    ['lone low surrogate', { title: 'a' + String.fromCharCode(0xdc00) + 'b' }],
    ['newline in title', { title: 'a\nb' }],
    ['bad IANA zone', { timeZone: 'Mars/Phobos' }],
    ['empty zone', { timeZone: '' }],
    ['zone with spaces', { timeZone: 'Europe/ Paris' }],
    ['bad gradient hex', { theme: { paletteId: 'a', cardStyle: 'b', typography: 'c', gradient: ['#GGGGGG', '#000000'] } }],
    ['short gradient hex', { theme: { paletteId: 'a', cardStyle: 'b', typography: 'c', gradient: ['#FFF', '#000000'] } }],
    ['3 colors', { theme: { paletteId: 'a', cardStyle: 'b', typography: 'c', gradient: ['#000000', '#000000', '#000000'] } }],
    ['bad palette id', { theme: { paletteId: 'Has Space', cardStyle: 'b', typography: 'c' } }],
    ['unknown theme key', { theme: { paletteId: 'a', cardStyle: 'b', typography: 'c', image: 'x' } }],
    ['two emoji', { emoji: cp(0x1f600, 0x1f600) }],
    ['text as emoji', { emoji: 'ab' }],
    ['empty emoji', { emoji: '' }],
    ['emoji over 16 bytes', { emoji: cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466, 0x200d, 0x1f466) }],
    ['bad unitMode', { unitMode: 'business' }],
    ['yearly without year', { recurrence: { type: 'yearly', originalYear: null, days: null } }],
    ['originalYear on weekly', { recurrence: { type: 'weekly', originalYear: 2020, days: null } }],
    ['customDays without days', { recurrence: { type: 'customDays', originalYear: null, days: null } }],
    ['customDays 3651', { recurrence: { type: 'customDays', originalYear: null, days: 3651 } }],
    ['customDays 0', { recurrence: { type: 'customDays', originalYear: null, days: 0 } }],
    ['bad recurrence type', { recurrence: { type: 'daily', originalYear: null, days: null } }],
    ['wrong v', { v: 2 }],
    ['title not string', { title: 5 }],
  ];
  it.each(cases)('rejects %s', async (_n, over) => {
    await expectStatus(await post(body({ payload: validPayload(over) })), 400, 'invalid_payload');
  });

  it('rejects memos and includeMemos at the top level', async () => {
    await expectStatus(await post(body({ memos: [] })), 400, 'invalid_payload');
    await expectStatus(await post(body({ includeMemos: true })), 400, 'invalid_payload');
  });
  it('rejects expiresAt on create', async () => {
    await expectStatus(await post(body({ expiresAt: '2030-01-01T00:00:00Z' })), 400, 'invalid_payload');
  });
  it('rejects bad expiresInDays', async () => {
    for (const d of [0, 366, 1.5, '30']) await expectStatus(await post(body({ expiresInDays: d })), 400, 'invalid_payload');
    for (const d of [1, 365, null]) await expectStatus(await post(body({ expiresInDays: d })), 201);
  });
  it('rejects non-object bodies and invalid JSON', async () => {
    for (const b of [[], 'x', 5, null]) await expectStatus(await post(b), 400, 'invalid_payload');
    const res = await call('POST', '/api/v1/shares', { raw: '{nope', headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL } });
    await expectStatus(res, 400, 'invalid_payload');
    const empty = await call('POST', '/api/v1/shares', { raw: '', headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL } });
    await expectStatus(empty, 400, 'invalid_payload');
  });
  it('rejects invalid UTF-8', async () => {
    const res = await call('POST', '/api/v1/shares', {
      raw: new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]),
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL },
    });
    await expectStatus(res, 400, 'invalid_payload');
  });
  it('error messages never echo user content', async () => {
    const res = await post(body({ payload: validPayload({ 'SECRET_KEY_NAME': 'SECRET_VALUE' }) }));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toContain('SECRET');
  });
  it('NFC-normalizes and trims the title', async () => {
    const res = await post(body({ payload: validPayload({ title: '  Cafe' + cp(0x301) + '  ' }) }));
    expect(res.status).toBe(201);
    const { shareToken } = await res.json<{ shareToken: string }>();
    const got = await call('GET', `/api/v1/shares/${shareToken}`);
    expect((await got.json<{ payload: { title: string } }>()).payload.title).toBe('Caf' + cp(0xe9));
  });
  it('accepts a 2-person ZWJ emoji (11 bytes)', async () => {
    await expectStatus(await post(body({ payload: validPayload({ emoji: cp(0x1f468, 0x200d, 0x1f469) }) })), 201);
  });
});
