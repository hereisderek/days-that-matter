// Shared fixtures for event, history and sharing tests: ids, a valid document, both stores, and an
// owner with people on one event.
import { expect } from 'vitest';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { openSqliteStore } from '../../src/node/node-sqlite-driver.ts';
import type { Store } from '../../src/ports/store.ts';
import type { Api } from './api.ts';

export const THEME = { paletteId: 'violet', cardStyle: 'glass', typography: 'modern' };
export const DOC = { title: 'Our wedding', targetDate: '2027-06-12', theme: THEME };
export const uuid = (n: number): string => `0b8f3c1e-6d0a-4a51-9f61-${String(n).padStart(12, '0')}`;
export const DAY_MS = 86_400_000;

export type ErrorBody = { error: { code: string; message: string; details: Record<string, unknown> | null } };

export const stores: Record<string, () => Promise<Store>> = {
  MemoryStore: async () => new MemoryStore(),
  SqlStore: async () => (await openSqliteStore()).store,
};

export interface Person {
  readonly token: string;
  readonly accountId: string;
}

/** An owner with event `uuid(1)` (with notes) and, by name, people added with `role` straight in the store. */
export async function sharedEvent(
  api: Api,
  people: Readonly<Record<string, 'viewer' | 'editor'>> = { Editor: 'editor' },
): Promise<{ owner: Person; people: Record<string, Person> }> {
  const owner = await api.google('owner-sub', undefined, 'Owner');
  const created = await api.call('PUT', `events/${uuid(1)}`, { token: owner.token, body: { ...DOC, notes: 'Book the photographer' } });
  expect(created.status).toBe(201);
  const out: Record<string, Person> = {};
  for (const [name, role] of Object.entries(people)) {
    const p = await api.google(`${name.toLowerCase()}-sub`, undefined, name);
    await api.ports.store.putMember({ eventId: uuid(1), accountId: p.accountId, role, inviteId: null, now: 0 });
    out[name] = p;
  }
  return { owner, people: out };
}

/** The person called `name`, or a failing test. */
export function pick(people: Readonly<Record<string, Person>>, name: string): Person {
  const p = people[name];
  if (!p) throw new Error(`no person ${name}`);
  return p;
}

/** Patches event `uuid(1)` at its current rev; returns the new rev. */
export async function patchAs(api: Api, token: string, patch: Record<string, unknown>): Promise<number> {
  const current = await api.call<{ rev: number }>('GET', `events/${uuid(1)}`, { token });
  const r = await api.call<{ event: { rev: number } }>('PATCH', `events/${uuid(1)}`, { token, body: { baseRev: current.body.rev, patch } });
  expect(r.status).toBe(200);
  return r.body.event.rev;
}
