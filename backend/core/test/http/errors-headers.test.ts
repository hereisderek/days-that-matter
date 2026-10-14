import { describe, expect, it } from 'vitest';
import { ApiError, errorResponse, internalError, invalidPayload, notFound, payloadTooLarge, serviceUnavailable, unsupportedMediaType } from '../../src/http/errors.ts';
import { applyResponseHeaders, pageHeaders } from '../../src/http/headers.ts';
import { emptyResponse, jsonResponse } from '../../src/http/types.ts';
import { json } from '../helpers.ts';

describe('error envelope', () => {
  it('has code, message and details with the contract status', async () => {
    const res = errorResponse(invalidPayload('title', 'too long'));
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(await json(res)).toEqual({ error: { code: 'invalid_payload', message: 'title: too long', details: { field: 'title' } } });
    expect((await json(errorResponse(invalidPayload('', 'invalid JSON'))) as { error: { message: string } }).error.message).toBe('(body): invalid JSON');
  });

  it('404s are byte-identical', () => {
    expect(errorResponse(notFound()).body).toBe(errorResponse(notFound()).body);
    expect(errorResponse(notFound()).body).toBe('{"error":{"code":"not_found","message":"Not found","details":null}}');
  });

  it('every constructor maps to its status', () => {
    expect([payloadTooLarge(), unsupportedMediaType(), internalError('r1'), serviceUnavailable()].map((e) => [e.status, e.code])).toEqual([
      [413, 'payload_too_large'], [415, 'unsupported_media_type'], [500, 'internal_error'], [503, 'service_unavailable'],
    ]);
    expect(internalError('r1').details).toEqual({ requestId: 'r1' });
    expect(serviceUnavailable().headers).toEqual({ 'Retry-After': '60' });
    expect(new ApiError('quota_exceeded', 'x').status).toBe(429);
    expect(new ApiError('quota_exceeded', 'x')).toBeInstanceOf(Error);
  });
});

describe('response headers', () => {
  it('adds request id, nosniff and no-referrer, and no-store on errors only', () => {
    const ok = jsonResponse(200, {});
    applyResponseHeaders(ok.headers, 'req-1', 200);
    expect(ok.headers.get('X-Request-Id')).toBe('req-1');
    expect(ok.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(ok.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(ok.headers.get('Cache-Control')).toBeNull();
    const err = emptyResponse(404);
    applyResponseHeaders(err.headers, 'req-2', 404);
    expect(err.headers.get('Cache-Control')).toBe('no-store');
    const gone = emptyResponse(410, { 'Cache-Control': 'public, max-age=60' });
    applyResponseHeaders(gone.headers, 'req-3', 410);
    expect(gone.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('strips cookies and CORS headers', () => {
    const res = emptyResponse(200, { 'Set-Cookie': 'a=b', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    applyResponseHeaders(res.headers, 'r', 200);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect([...res.headers.keys()].filter((k) => k.startsWith('access-control-'))).toEqual([]);
  });

  it('page headers carry the CSP of BACKEND.md section 14', () => {
    const h = pageHeaders('https://dtm.example', 'https://media.dtm.example');
    expect(h['Content-Security-Policy']).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https://media.dtm.example; " +
        "media-src 'self' https://media.dtm.example; font-src 'self'; connect-src 'self' wss://dtm.example; form-action 'none'; " +
        "base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; upgrade-insecure-requests",
    );
    expect(h['Cache-Control']).toBe('no-store');
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });
});
