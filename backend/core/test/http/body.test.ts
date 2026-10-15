import { describe, expect, it } from 'vitest';
import { readBody, readJsonObject } from '../../src/http/body.ts';
import { ApiError } from '../../src/http/errors.ts';
import { request, streamOf } from '../helpers.ts';

const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError) return `${e.status} ${e.code} ${e.message}`;
    throw e;
  }
}

describe('readBody', () => {
  it('reads chunked bodies', async () => {
    const req = { ...request('POST', '/x'), body: streamOf(new Uint8Array([1, 2]), new Uint8Array([3])) };
    expect([...(await readBody(req, 3))]).toEqual([1, 2, 3]);
    expect((await readBody(request('POST', '/x'), 10)).byteLength).toBe(0);
  });

  it('fails on a declared or actual size over the limit', async () => {
    expect(await code(readBody(request('POST', '/x', { body: 'abc', headers: { 'Content-Length': '4' } }), 3))).toMatch(/^413 payload_too_large/);
    const req = { ...request('POST', '/x'), body: streamOf(new Uint8Array(2), new Uint8Array(2)) };
    expect(await code(readBody(req, 3))).toMatch(/^413 payload_too_large/);
  });
});

describe('readJsonObject', () => {
  it('parses a JSON object', async () => {
    expect(await readJsonObject(request('POST', '/x', { body: '{"a":[1]}', headers: JSON_TYPE }))).toEqual({ a: [1] });
    expect(await readJsonObject(request('POST', '/x', { body: '{}', headers: { 'Content-Type': 'application/json' } }))).toEqual({});
  });

  it('refuses other content types with 415', async () => {
    for (const type of ['text/plain', 'application/jsonx', '']) {
      expect(await code(readJsonObject(request('POST', '/x', { body: '{}', headers: { 'Content-Type': type } })))).toMatch(/^415/);
    }
  });

  it('refuses bodies over 64 KB with 413', async () => {
    const big = `{"a":"${'x'.repeat(65_536)}"}`;
    expect(await code(readJsonObject(request('POST', '/x', { body: big, headers: JSON_TYPE })))).toMatch(/^413/);
  });

  it('refuses invalid JSON, invalid UTF-8 and non-objects with 400 without echoing input', async () => {
    expect(await code(readJsonObject(request('POST', '/x', { body: '{"secret": ', headers: JSON_TYPE })))).toBe('400 invalid_payload (body): invalid JSON');
    expect(await code(readJsonObject(request('POST', '/x', { body: new Uint8Array([0x7b, 0xff, 0x7d]), headers: JSON_TYPE })))).toBe('400 invalid_payload (body): invalid JSON');
    for (const body of ['[]', '"s"', 'null', '3']) {
      expect(await code(readJsonObject(request('POST', '/x', { body, headers: JSON_TYPE })))).toBe('400 invalid_payload (body): must be an object');
    }
  });
});
