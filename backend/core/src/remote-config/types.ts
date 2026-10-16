// Document structure for Remote Configuration (BACKEND.md section 7.6).

export type RemoteConfigPrimitive = number | string | boolean | null;

export type RemoteConfigDelivery = 'background' | 'blocking';

export interface RemoteConfigValueEntry {
  readonly value: RemoteConfigPrimitive;
  readonly delivery: RemoteConfigDelivery;
}

export interface RemoteConfigDocument {
  readonly version: number;
  readonly ttlSeconds: number;
  readonly audience: string;
  readonly values: Record<string, RemoteConfigValueEntry>;
}
