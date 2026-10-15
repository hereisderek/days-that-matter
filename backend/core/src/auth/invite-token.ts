// Invite tokens (design D10, BACKEND.md section 14): 22 characters base64url, looked up by SHA-256 hex
// and kept as AES-GCM ciphertext under INVITE_KEY so the owner can copy the URL on any device. Public
// link tokens use the same format and are stored in clear.
import { base64Url, token22 } from '../ports/random.ts';
import type { Random } from '../ports/random.ts';
import { fromBase64Url, sha256Hex } from './crypto.ts';

/** The format of public link, invite and export tokens; checked before any store access. */
export const TOKEN_FORMAT = /^[A-Za-z0-9_-]{22}$/;

/** Version prefix of `invites.token_enc`: `v1.` + base64url(12-byte IV, ciphertext with its 16-byte tag). */
const SEALED_V1 = 'v1.';
const IV_BYTES = 12;
const encoder = new TextEncoder();
/** WebCrypto's key type, named without the DOM library. */
type AesKey = Awaited<ReturnType<typeof crypto.subtle.deriveKey>>;
const keys = new Map<string, Promise<AesKey>>();

/**
 * The AES-256-GCM key of a deployment: HKDF-SHA-256 over the INVITE_KEY text with a fixed label, so
 * the secret can be any string and the key is used for nothing else. Derived once per secret.
 */
function inviteKey(secret: string): Promise<AesKey> {
  let key = keys.get(secret);
  if (!key) {
    key = (async () => {
      const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('days-that-matter invite token v1') },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    })();
    keys.set(secret, key);
  }
  return key;
}

export interface NewInviteToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly tokenEnc: string;
}

/** A fresh invite token for invite `inviteId`, with its hash and its ciphertext bound to that id. */
export async function newInviteToken(secret: string, inviteId: string, random: Random): Promise<NewInviteToken> {
  const token = token22(random);
  return { token, tokenHash: await sha256Hex(token), tokenEnc: await sealInviteToken(secret, inviteId, token, random) };
}

export async function sealInviteToken(secret: string, inviteId: string, token: string, random: Random): Promise<string> {
  const iv = random.bytes(IV_BYTES);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(inviteId) },
    await inviteKey(secret),
    encoder.encode(token),
  );
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return SEALED_V1 + base64Url(out);
}

/** The token sealed for `inviteId`, or null when the text was not sealed for it under this secret. */
export async function openInviteToken(secret: string, inviteId: string, sealed: string): Promise<string | null> {
  if (!sealed.startsWith(SEALED_V1)) return null;
  const bytes = fromBase64Url(sealed.slice(SEALED_V1.length));
  if (bytes === null || bytes.byteLength <= IV_BYTES) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES), additionalData: encoder.encode(inviteId) },
      await inviteKey(secret),
      bytes.subarray(IV_BYTES),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
