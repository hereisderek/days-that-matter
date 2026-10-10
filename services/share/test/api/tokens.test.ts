import { describe, it, expect } from 'vitest';
import { constantTimeEqual, generateManageToken, generateShareToken, isManageToken, isShareToken, sha256Hex } from '../../src/lib/tokens';

describe('tokens', () => {
  it('share token is 22 chars base64url', () => {
    for (let i = 0; i < 50; i++) expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
  it('manage token is mt_ + 43 chars', () => {
    for (let i = 0; i < 50; i++) expect(generateManageToken()).toMatch(/^mt_[A-Za-z0-9_-]{43}$/);
  });
  it('100k share tokens do not collide', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100_000; i++) seen.add(generateShareToken());
    expect(seen.size).toBe(100_000);
  });
  it('sha256 hex format and known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(generateShareToken())).toMatch(/^[0-9a-f]{64}$/);
  });
  it('format checks', () => {
    expect(isShareToken('a'.repeat(22))).toBe(true);
    expect(isShareToken('a'.repeat(21))).toBe(false);
    expect(isShareToken('a'.repeat(23))).toBe(false);
    expect(isShareToken('a'.repeat(21) + '+')).toBe(false);
    expect(isManageToken('mt_' + 'a'.repeat(43))).toBe(true);
    expect(isManageToken('xx_' + 'a'.repeat(43))).toBe(false);
  });
  it('constant time compare', () => {
    expect(constantTimeEqual('abcd', 'abcd')).toBe(true);
    expect(constantTimeEqual('abcd', 'abce')).toBe(false);
    expect(constantTimeEqual('abcd', 'abc')).toBe(false);
  });
});
