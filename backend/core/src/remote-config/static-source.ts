import type { RemoteConfigSource } from '../ports/remote-config.ts';
import { buildConfigValues, sanitizeRemoteConfigDocument } from './catalog.ts';
import type {
  RemoteConfigDocument,
  RemoteConfigPrimitive,
  RemoteConfigValueEntry,
} from './types.ts';

export interface StaticRemoteConfigSourceOptions {
  readonly overrides?: Record<string, RemoteConfigValueEntry | RemoteConfigPrimitive>;
  readonly audienceOverrides?: Record<string, Record<string, RemoteConfigValueEntry | RemoteConfigPrimitive>>;
  readonly version?: number;
  readonly ttlSeconds?: number;
}

export type StaticRemoteConfigSourceInput =
  | StaticRemoteConfigSourceOptions
  | Record<string, RemoteConfigValueEntry | RemoteConfigPrimitive>;

function isOptions(input: StaticRemoteConfigSourceInput): input is StaticRemoteConfigSourceOptions {
  return 'overrides' in input || 'audienceOverrides' in input || 'version' in input || 'ttlSeconds' in input;
}

export class StaticRemoteConfigSource implements RemoteConfigSource {
  private readonly options: StaticRemoteConfigSourceOptions;

  constructor(input: StaticRemoteConfigSourceInput = {}) {
    if (isOptions(input)) {
      this.options = input;
    } else {
      this.options = { overrides: input };
    }
  }

  async getConfig(audience: string): Promise<RemoteConfigDocument> {
    const rawValues: Record<string, unknown> = {
      ...(this.options.overrides ?? {}),
      ...(this.options.audienceOverrides?.[audience] ?? {}),
    };

    const values = buildConfigValues(rawValues);

    return sanitizeRemoteConfigDocument(
      {
        version: this.options.version,
        ttlSeconds: this.options.ttlSeconds,
        audience,
        values,
      },
      audience,
      {
        version: this.options.version,
        ttlSeconds: this.options.ttlSeconds,
      },
    );
  }
}
