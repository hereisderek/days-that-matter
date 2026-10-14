/** Randomness; injected so tests are deterministic. Production uses the platform CSPRNG. */
export interface Random {
  bytes(length: number): Uint8Array;
  uuid(): string;
}

export const cryptoRandom: Random = {
  bytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  uuid: () => crypto.randomUUID(),
};

/** base64url without padding. */
export function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A 22-character token of 128 bits: public links, invites, exports, media ids (BACKEND.md section 14). */
export function token22(random: Random): string {
  return base64Url(random.bytes(16));
}
