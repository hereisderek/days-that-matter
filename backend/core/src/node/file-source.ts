import { readFileSync, watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import type { RemoteConfigSource } from '../ports/remote-config.ts';
import { buildConfigValues, sanitizeRemoteConfigDocument } from '../remote-config/catalog.ts';
import type { RemoteConfigDocument } from '../remote-config/types.ts';

export interface FileRemoteConfigOptions {
  readonly version?: number;
  readonly ttlSeconds?: number;
  readonly autoWatch?: boolean;
}

export class FileRemoteConfigSource implements RemoteConfigSource {
  private currentRaw: Record<string, unknown> | null = null;
  private watcher: FSWatcher | null = null;
  private readonly filePath: string;
  private readonly options: FileRemoteConfigOptions;

  constructor(filePath: string, options: FileRemoteConfigOptions = {}) {
    this.filePath = filePath;
    this.options = options;
    this.reload();
    if (options.autoWatch !== false) {
      try {
        this.watcher = watch(this.filePath, () => {
          this.reload();
        });
        if (typeof this.watcher.unref === 'function') {
          this.watcher.unref();
        }
      } catch {
        // Watch may fail in environments without fs.watch support or before file creation
      }
    }
  }

  reload(): void {
    try {
      const content = readFileSync(this.filePath, 'utf-8');
      this.currentRaw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Keep previous valid currentRaw on transient read errors
    }
  }

  async getConfig(audience: string): Promise<RemoteConfigDocument> {
    const raw = this.currentRaw ?? {};
    let rawValues: Record<string, unknown> = {};
    let version = this.options.version;
    let ttlSeconds = this.options.ttlSeconds;

    if (typeof raw === 'object' && raw !== null) {
      if (typeof raw['version'] === 'number') version = raw['version'] as number;
      if (typeof raw['ttlSeconds'] === 'number') ttlSeconds = raw['ttlSeconds'] as number;

      if (raw['values'] && typeof raw['values'] === 'object' && !Array.isArray(raw['values'])) {
        rawValues = { ...(raw['values'] as Record<string, unknown>) };
      } else {
        rawValues = { ...raw };
        delete rawValues['version'];
        delete rawValues['ttlSeconds'];
        delete rawValues['audiences'];
      }

      const audiences = raw['audiences'];
      if (audiences && typeof audiences === 'object' && !Array.isArray(audiences)) {
        const audRecord = (audiences as Record<string, unknown>)[audience];
        if (audRecord && typeof audRecord === 'object' && !Array.isArray(audRecord)) {
          Object.assign(rawValues, audRecord);
        }
      }
    }

    const values = buildConfigValues(rawValues);

    return sanitizeRemoteConfigDocument(
      {
        version,
        ttlSeconds,
        audience,
        values,
      },
      audience,
      { version, ttlSeconds },
    );
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
