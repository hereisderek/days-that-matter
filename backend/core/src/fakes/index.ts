import { staticKeyFetcher } from '../auth/keys.ts';
import type { Ports } from '../ports/index.ts';
import { StaticRemoteConfigSource } from '../remote-config/static-source.ts';
import { FakeClock, FakeRandom, MemoryBlobStore, MemoryLiveHub, MemoryMailer, testConfig } from './fakes.ts';
import { MemoryStore } from './memory-store.ts';

export { FakeClock, FakeRandom, MemoryBlobStore, MemoryLiveHub, MemoryMailer, testConfig } from './fakes.ts';
export { MemoryStore } from './memory-store.ts';

export interface FakePorts extends Ports {
  readonly store: MemoryStore;
  readonly blobs: MemoryBlobStore;
  readonly live: MemoryLiveHub;
  readonly mailer: MemoryMailer;
  readonly clock: FakeClock;
  readonly random: FakeRandom;
}

/** Every port as an in-memory fake; the core test suite runs against these. */
export function fakePorts(overrides: Partial<Ports> = {}): FakePorts {
  return {
    store: new MemoryStore(),
    blobs: new MemoryBlobStore(),
    live: new MemoryLiveHub(),
    mailer: new MemoryMailer(),
    clock: new FakeClock(),
    random: new FakeRandom(),
    config: testConfig(),
    keys: staticKeyFetcher({}),
    remoteConfig: new StaticRemoteConfigSource(),
    ...overrides,
  } as FakePorts;
}

