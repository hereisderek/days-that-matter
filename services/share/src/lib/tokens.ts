const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
const MANAGE_TOKEN_RE = /^mt_[A-Za-z0-9_-]{43}$/;

export const isShareToken = (t: string): boolean => SHARE_TOKEN_RE.test(t);
export const isManageToken = (t: string): boolean => MANAGE_TOKEN_RE.test(t);

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomToken(byteLength: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** 128 bits, 22 chars base64url. */
export const generateShareToken = (): string => randomToken(16);

/** 256 bits, `mt_` + 43 chars base64url. */
export const generateManageToken = (): string => `mt_${randomToken(32)}`;

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison for equal-length strings (hex digests). Unequal lengths return false. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
