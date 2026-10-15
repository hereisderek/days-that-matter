// In-memory fakes of the ports for core tests (task 3.2).
import type { LiveMessage, LiveMode } from '../contract/index.ts';
import type { BlobObject, BlobStore } from '../ports/blob.ts';
import type { Clock } from '../ports/clock.ts';
import { loadConfig } from '../ports/config.ts';
import type { Config, Env } from '../ports/config.ts';
import type { LiveHub } from '../ports/live.ts';
import type { MailMessage, Mailer } from '../ports/mailer.ts';
import type { Random } from '../ports/random.ts';

export class FakeClock implements Clock {
  #ms: number;

  constructor(start: string | number = '2026-10-12T15:04:05Z') {
    this.#ms = typeof start === 'number' ? start : Date.parse(start);
  }

  nowMs(): number {
    return this.#ms;
  }

  set(at: string | number): void {
    this.#ms = typeof at === 'number' ? at : Date.parse(at);
  }

  advance(ms: number): void {
    this.#ms += ms;
  }
}

/** Deterministic bytes from a counter: the same sequence on every run. Never for production. */
export class FakeRandom implements Random {
  #next = 1;

  bytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = (this.#next++ * 151) & 0xff;
    return out;
  }

  uuid(): string {
    const b = this.bytes(16);
    b[6] = ((b[6] as number) & 0x0f) | 0x40;
    b[8] = ((b[8] as number) & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export class MemoryBlobStore implements BlobStore {
  readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  readonly #origin: string;

  constructor(mediaOrigin = 'https://media.example.test') {
    this.#origin = mediaOrigin;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { bytes: bytes.slice(), contentType });
  }

  async get(key: string): Promise<BlobObject | null> {
    const file = this.files.get(key);
    if (!file) return null;
    const bytes = file.bytes.slice();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return { body, contentType: file.contentType, size: bytes.byteLength };
  }

  async delete(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.files.delete(key);
  }

  publicUrl(key: string): string {
    return `${this.#origin}/${key}`;
  }
}

/** Records published notices; `poll` mode records nothing, like a real poll deployment. */
export class MemoryLiveHub implements LiveHub {
  readonly mode: LiveMode;
  readonly published: { eventId: string; message: LiveMessage }[] = [];

  constructor(mode: LiveMode = 'ws') {
    this.mode = mode;
  }

  async publish(eventId: string, message: LiveMessage): Promise<void> {
    if (this.mode === 'ws') this.published.push({ eventId, message: { ...message } });
  }
}

export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  /** Set to make the next sends fail, as when the mail provider refuses. */
  failing = false;

  async send(message: MailMessage): Promise<void> {
    if (this.failing) throw new Error('mail provider refused');
    this.sent.push({ ...message });
  }
}

/** A valid test configuration; `overrides` replace environment variables. */
export function testConfig(overrides: Env = {}): Config {
  return loadConfig({
    ORIGIN: 'https://dtm.example.test',
    MEDIA_ORIGIN: 'https://media.example.test',
    LIVE_MODE: 'ws',
    SIGN_IN: 'apple,google,email',
    STORES: 'apple,google',
    VERSION: 'test',
    RATE_SALT: 'test-rate-salt',
    EMAIL_CODE_KEY: 'test-email-code-key',
    INVITE_KEY: 'test-invite-key',
    ...overrides,
  });
}
