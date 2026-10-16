// Compiled-in remote configuration catalog, defaults, and range validation (BACKEND.md section 7.6).
import plansJson from '../../contract/plans.json' with { type: 'json' };
import type { Feature, Plan } from '../contract/index.ts';
import type {
  RemoteConfigDelivery,
  RemoteConfigDocument,
  RemoteConfigPrimitive,
  RemoteConfigValueEntry,
} from './types.ts';

export interface KeySchema {
  readonly defaultValue: RemoteConfigPrimitive;
  readonly delivery: RemoteConfigDelivery;
  readonly isValid: (value: unknown) => boolean;
}

const DEFAULT_TTL_SECONDS = 3600;
const DEFAULT_VERSION = 1;

function isNonNegativeInteger(v: unknown): boolean {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function isIntegerInRange(min: number, max: number): (v: unknown) => boolean {
  return (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
}

export function buildCatalog(): Record<string, KeySchema> {
  const catalog: Record<string, KeySchema> = {};

  const plans = plansJson.plans as Plan[];
  const features = plansJson.features as Feature[];
  const limits = plansJson.limits as Record<Plan, Record<Feature, number | null>>;

  // Plan limits: plans.<plan>.<feature>
  for (const plan of plans) {
    for (const feature of features) {
      const def = limits[plan]?.[feature] ?? null;
      const key = `plans.${plan}.${feature}`;
      catalog[key] = {
        defaultValue: def,
        delivery: 'background',
        isValid: (v: unknown) => {
          if (plan === 'free') {
            return isNonNegativeInteger(v);
          }
          return v === null || isNonNegativeInteger(v);
        },
      };
    }
  }

  // Media thresholds
  catalog['media.photo_max_bytes'] = {
    defaultValue: 1572864, // 1.5 MB
    delivery: 'background',
    isValid: isIntegerInRange(1024, 50_000_000),
  };
  catalog['media.photo_max_pixels'] = {
    defaultValue: 2560,
    delivery: 'background',
    isValid: isIntegerInRange(100, 20_000),
  };
  catalog['media.motion_max_bytes'] = {
    defaultValue: 4194304, // 4 MB
    delivery: 'background',
    isValid: isIntegerInRange(1024, 50_000_000),
  };
  catalog['media.motion_max_seconds'] = {
    defaultValue: 5,
    delivery: 'background',
    isValid: isIntegerInRange(1, 60),
  };
  catalog['media.motion_max_pixels'] = {
    defaultValue: 1280,
    delivery: 'background',
    isValid: isIntegerInRange(100, 20_000),
  };
  catalog['media.audio_max_bytes'] = {
    defaultValue: 4194304, // 4 MB
    delivery: 'background',
    isValid: isIntegerInRange(1024, 50_000_000),
  };

  // Sign-in suggestion rules
  catalog['signin.suggest_event_count'] = {
    defaultValue: 3,
    delivery: 'background',
    isValid: isIntegerInRange(1, 1000),
  };
  catalog['signin.suggest_after_days'] = {
    defaultValue: 7,
    delivery: 'background',
    isValid: isIntegerInRange(1, 365),
  };

  return catalog;
}

export const CATALOG: Readonly<Record<string, KeySchema>> = buildCatalog();

function isRemoteConfigPrimitive(v: unknown): v is RemoteConfigPrimitive {
  return v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
}

/**
 * Builds and sanitizes remote config values from raw input:
 * - Every known key is ensured to exist.
 * - Out-of-range or missing values fall back to compiled-in defaults.
 * - Unknown keys are preserved if primitive.
 */
export function buildConfigValues(rawValues?: Record<string, unknown>): Record<string, RemoteConfigValueEntry> {
  const result: Record<string, RemoteConfigValueEntry> = {};
  const raw = rawValues ?? {};

  // 1. Process known catalog keys
  for (const [key, schema] of Object.entries(CATALOG)) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const entry = raw[key];
      let candidateVal: unknown;
      let candidateDelivery: unknown;

      if (typeof entry === 'object' && entry !== null && 'value' in entry) {
        candidateVal = (entry as { value: unknown }).value;
        candidateDelivery = (entry as { delivery?: unknown }).delivery;
      } else {
        candidateVal = entry;
      }

      if (schema.isValid(candidateVal)) {
        const delivery: RemoteConfigDelivery =
          candidateDelivery === 'blocking' || candidateDelivery === 'background'
            ? candidateDelivery
            : schema.delivery;
        result[key] = {
          value: candidateVal as RemoteConfigPrimitive,
          delivery,
        };
      } else {
        // Out of range or invalid type: fall back to compiled-in default
        result[key] = {
          value: schema.defaultValue,
          delivery: schema.delivery,
        };
      }
    } else {
      // Missing key: fall back to compiled-in default
      result[key] = {
        value: schema.defaultValue,
        delivery: schema.delivery,
      };
    }
  }

  // 2. Preserve unknown keys
  for (const [key, entry] of Object.entries(raw)) {
    if (Object.prototype.hasOwnProperty.call(CATALOG, key)) continue;

    if (typeof entry === 'object' && entry !== null && 'value' in entry) {
      const candidateVal = (entry as { value: unknown }).value;
      const candidateDelivery = (entry as { delivery?: unknown }).delivery;
      if (isRemoteConfigPrimitive(candidateVal)) {
        result[key] = {
          value: candidateVal,
          delivery: candidateDelivery === 'blocking' ? 'blocking' : 'background',
        };
      }
    } else if (isRemoteConfigPrimitive(entry)) {
      result[key] = {
        value: entry,
        delivery: 'background',
      };
    }
  }

  return result;
}

export interface RawRemoteConfigDocument {
  readonly version?: number | undefined;
  readonly ttlSeconds?: number | undefined;
  readonly audience?: string | undefined;
  readonly values?: Record<string, unknown> | undefined;
}

export interface DocumentOptions {
  readonly version?: number | undefined;
  readonly ttlSeconds?: number | undefined;
}

/** Sanitizes and validates a document, filling defaults for missing/out-of-range keys. */
export function sanitizeRemoteConfigDocument(
  raw: RawRemoteConfigDocument | null | undefined,
  audience: string,
  options: DocumentOptions = {},
): RemoteConfigDocument {
  const version =
    raw?.version && typeof raw.version === 'number' && Number.isSafeInteger(raw.version) && raw.version >= 1
      ? raw.version
      : options.version ?? DEFAULT_VERSION;

  const ttlSeconds =
    raw?.ttlSeconds && typeof raw.ttlSeconds === 'number' && Number.isSafeInteger(raw.ttlSeconds) && raw.ttlSeconds >= 0
      ? raw.ttlSeconds
      : options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const values = buildConfigValues(raw?.values);

  return {
    version,
    ttlSeconds,
    audience,
    values,
  };
}
