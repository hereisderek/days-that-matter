import { describe, expect, it } from 'vitest';
import { FakeClock, FakeRandom, MemoryBlobStore, MemoryLiveHub, MemoryMailer, fakePorts, testConfig } from '../../src/fakes/index.ts';
import { MemoryStore } from '../../src/fakes/memory-store.ts';
import { nowSeconds, systemClock } from '../../src/ports/clock.ts';
import { pollHub } from '../../src/ports/live.ts';
import { base64Url, cryptoRandom, token22 } from '../../src/ports/random.ts';

describe('clock', () => {
  it('fake clock sets and advances; seconds are floored', () => {
    const c = new FakeClock('2026-10-12T15:04:05.900Z');
    expect(nowSeconds(c)).toBe(1_791_817_445);
    c.advance(100);
    expect(nowSeconds(c)).toBe(1_791_817_446);
    c.set(0);
    expect(c.nowMs()).toBe(0);
    expect(Math.abs(systemClock.nowMs() - Date.now())).toBeLessThan(1000);
  });
});

describe('random', () => {
  it('fake random is deterministic and gives v4 uuids', () => {
    const a = new FakeRandom();
    const b = new FakeRandom();
    expect(a.uuid()).toBe(b.uuid());
    expect(a.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a.uuid()).not.toBe(a.uuid());
  });

  it('fake random does not repeat ids or tokens within a long test', () => {
    const r = new FakeRandom();
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(i % 2 === 0 ? r.uuid() : token22(r));
    expect(seen.size).toBe(20_000);
  });

  it('tokens are 22 base64url characters', () => {
    expect(token22(new FakeRandom())).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(token22(cryptoRandom)).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(base64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(cryptoRandom.uuid()).not.toBe(cryptoRandom.uuid());
  });
});

describe('blob, live and mail fakes', () => {
  it('blob store puts, streams, deletes and builds public URLs', async () => {
    const blobs = new MemoryBlobStore('https://media.x');
    await blobs.put('m/a.jpg', new Uint8Array([1, 2, 3]), 'image/jpeg');
    const file = await blobs.get('m/a.jpg');
    expect([file?.contentType, file?.size]).toEqual(['image/jpeg', 3]);
    expect([...new Uint8Array(await new Response(file?.body).arrayBuffer())]).toEqual([1, 2, 3]);
    await blobs.delete(['m/a.jpg', 'unknown']);
    expect(await blobs.get('m/a.jpg')).toBeNull();
    expect(blobs.publicUrl('m/a.jpg')).toBe('https://media.x/m/a.jpg');
  });

  it('live hub records in ws mode only', async () => {
    const ws = new MemoryLiveHub('ws');
    await ws.publish('e1', { type: 'rev', rev: 3 });
    expect(ws.published).toEqual([{ eventId: 'e1', message: { type: 'rev', rev: 3 } }]);
    const poll = new MemoryLiveHub('poll');
    await poll.publish('e1', { type: 'access' });
    expect(poll.published).toEqual([]);
    expect(pollHub.mode).toBe('poll');
    await expect(pollHub.publish('e1', { type: 'access' })).resolves.toBeUndefined();
  });

  it('mailer records and can fail', async () => {
    const mailer = new MemoryMailer();
    await mailer.send({ to: 'a@b.c', subject: 's', text: 't' });
    expect(mailer.sent).toEqual([{ to: 'a@b.c', subject: 's', text: 't' }]);
    mailer.failing = true;
    await expect(mailer.send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toThrow();
  });

  it('fakePorts wires every port and takes overrides', () => {
    const ports = fakePorts();
    expect(ports.store).toBeInstanceOf(MemoryStore);
    expect(ports.config.version).toBe('test');
    expect(testConfig({ LIVE_MODE: 'poll' }).live).toBe('poll');
    const clock = new FakeClock(5);
    expect(fakePorts({ clock }).clock).toBe(clock);
  });
});
