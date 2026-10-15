// Task 3.4: the store conformance suite passes for SqlStore (node:sqlite) and MemoryStore, and fails
// for a deliberately broken store.
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import type { PatchInput, PatchOutcome, SignInInput, SignInOutcome, Store } from '../../src/ports/store.ts';
import { applyEventPatch } from '../../src/rules/merge.ts';
import { runStoreConformance, storeConformanceCases } from '../../src/store/conformance.ts';

const stores: Record<string, () => Promise<Store>> = {
  SqlStore: async () => (await openSqliteStore()).store,
  MemoryStore: async () => new MemoryStore(),
};

for (const [name, newStore] of Object.entries(stores)) {
  describe(`store conformance: ${name}`, () => {
    for (const c of storeConformanceCases) {
      it(c.name, async () => {
        await c.run(await newStore());
      });
    }
  });
}

/**
 * A store with the classic read-modify-write bug: it reads, yields, then writes without checking
 * that nobody wrote in between, does not write revisions, and reports no overwritten fields. It also
 * never counts email code attempts and links identities by unverified emails.
 */
class BrokenStore extends MemoryStore {
  override async takeEmailCodeAttempt(emailHash: string, now: number, _maxAttempts: number): Promise<string | null> {
    return super.takeEmailCodeAttempt(emailHash, now, Number.MAX_SAFE_INTEGER);
  }

  override async signIn(input: SignInInput): Promise<SignInOutcome> {
    return super.signIn({ ...input, identity: { ...input.identity, emailVerified: input.identity.email !== null } });
  }

  readonly #docs = new Map<string, { rev: number; doc: Record<string, never> }>();

  override async applyPatch(input: PatchInput): Promise<PatchOutcome> {
    const current = await super.getEvent(input.eventId);
    if (!current) return { status: 'not_found' };
    if (current.deletedAt !== null) return { status: 'deleted' };
    const seen = this.#docs.get(input.eventId) ?? { rev: current.rev, doc: current.doc as Record<string, never> };
    await new Promise((resolve) => setTimeout(resolve, 0));
    const result = applyEventPatch(seen.doc, input.patch);
    const next = { rev: seen.rev + 1, doc: result.doc as Record<string, never> };
    this.#docs.set(input.eventId, next);
    return { status: 'ok', event: { ...current, rev: next.rev, doc: next.doc }, applied: result.applied, overwritten: [] };
  }
}

describe('store conformance: a broken store fails', () => {
  it('reports the broken behavior instead of passing', async () => {
    const results = await runStoreConformance(async () => new BrokenStore());
    const failed = results.filter((r) => !r.passed).map((r) => r.name);
    expect(results).toHaveLength(storeConformanceCases.length);
    expect(failed).toEqual(
      expect.arrayContaining([
        'patch: bumps the rev and appends the revision',
        'patch: reports fields that replaced a newer change by someone else',
        'patch: concurrent writers lose nothing',
        'email codes: every attempt counts, up to the limit, and a code signs in once',
        'email codes: parallel guesses stay within the attempt limit',
        'sign-in: a verified email joins the account with that verified email',
      ]),
    );
    for (const r of results.filter((x) => !x.passed)) expect(r.error).toBeTruthy();
    expect(results.find((r) => r.name === 'account: create stores the defaults')?.passed).toBe(true);
  });

  it('a correct store passes every case through the runner', async () => {
    const results = await runStoreConformance(async () => new MemoryStore());
    expect(results.filter((r) => !r.passed)).toEqual([]);
  });
});
