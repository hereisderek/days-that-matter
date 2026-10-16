// Firebase Remote Config Adapter (BACKEND.md section 7.6).
import type { RemoteConfigSource } from '../ports/remote-config.ts';
import { CATALOG, buildConfigValues, sanitizeRemoteConfigDocument } from './catalog.ts';
import type {
  RemoteConfigDelivery,
  RemoteConfigDocument,
  RemoteConfigPrimitive,
} from './types.ts';

export interface FirebaseValue {
  readonly value?: string;
  readonly useInAppDefault?: boolean;
}

export interface FirebaseParameter {
  readonly defaultValue?: FirebaseValue;
  readonly conditionalValues?: Record<string, FirebaseValue>;
  readonly description?: string;
  readonly valueType?: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'JSON';
}

export interface FirebaseRemoteConfigTemplate {
  readonly parameters?: Record<string, FirebaseParameter>;
  readonly version?: {
    readonly versionNumber?: string | number;
  };
  readonly conditions?: Array<{
    readonly name: string;
    readonly expression?: string;
  }>;
}

export type TemplateProvider =
  | FirebaseRemoteConfigTemplate
  | (() => Promise<FirebaseRemoteConfigTemplate> | FirebaseRemoteConfigTemplate);

export interface FirebaseAdapterOptions {
  readonly ttlSeconds?: number;
}

function isPrimitive(v: unknown): v is RemoteConfigPrimitive {
  return v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
}

function parseFirebaseString(
  rawString: string,
  valueType?: string,
): { value: RemoteConfigPrimitive; delivery?: RemoteConfigDelivery } {
  const trimmed = rawString.trim();

  if (trimmed === 'null') return { value: null };
  if (trimmed === 'true') return { value: true };
  if (trimmed === 'false') return { value: false };

  // Explicit type handling if provided
  if (valueType === 'BOOLEAN') {
    return { value: trimmed.toLowerCase() === 'true' };
  }
  if (valueType === 'NUMBER') {
    const num = Number(trimmed);
    return { value: Number.isFinite(num) ? num : null };
  }

  // JSON handling
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && 'value' in parsed) {
        const val = (parsed as { value: unknown }).value;
        const del = (parsed as { delivery?: unknown }).delivery;
        const delivery: RemoteConfigDelivery | undefined =
          del === 'blocking' || del === 'background' ? del : undefined;
        const result: { value: RemoteConfigPrimitive; delivery?: RemoteConfigDelivery } = {
          value: isPrimitive(val) ? val : JSON.stringify(val),
        };
        if (delivery !== undefined) {
          result.delivery = delivery;
        }
        return result;
      }
      return { value: JSON.stringify(parsed) };
    } catch {
      // not valid JSON, proceed
    }
  }

  // Integer
  if (/^-?\d+$/.test(trimmed)) {
    const num = Number.parseInt(trimmed, 10);
    if (Number.isSafeInteger(num)) return { value: num };
  }

  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    const num = Number.parseFloat(trimmed);
    if (!Number.isNaN(num)) return { value: num };
  }

  return { value: rawString };
}

export class FirebaseRemoteConfigAdapter implements RemoteConfigSource {
  private readonly provider: TemplateProvider;
  private readonly options: FirebaseAdapterOptions;

  constructor(provider: TemplateProvider, options: FirebaseAdapterOptions = {}) {
    this.provider = provider;
    this.options = options;
  }

  async getConfig(audience: string): Promise<RemoteConfigDocument> {
    const template = typeof this.provider === 'function' ? await this.provider() : this.provider;
    const rawValues: Record<string, unknown> = {};

    const params = template.parameters ?? {};
    for (const [key, param] of Object.entries(params)) {
      if (!param) continue;

      // Check conditional values by audience first, then fallback to defaultValue
      let rawString: string | undefined;
      if (param.conditionalValues && param.conditionalValues[audience]?.value !== undefined) {
        rawString = param.conditionalValues[audience]?.value;
      } else if (param.defaultValue?.value !== undefined) {
        rawString = param.defaultValue.value;
      }

      if (rawString === undefined) continue;

      const parsed = parseFirebaseString(rawString, param.valueType);
      let delivery = parsed.delivery;
      if (!delivery && param.description) {
        const lowerDesc = param.description.toLowerCase();
        if (lowerDesc.includes('delivery:blocking') || lowerDesc.includes('delivery: blocking')) {
          delivery = 'blocking';
        }
      }

      // Normalize key (e.g. plans_free_events -> plans.free.events if in catalog)
      let targetKey = key;
      if (key.includes('_') && !CATALOG[key]) {
        const candidateKey = key.replace(/_/g, '.');
        if (CATALOG[candidateKey]) {
          targetKey = candidateKey;
        }
      }

      rawValues[targetKey] = {
        value: parsed.value,
        delivery: delivery ?? 'background',
      };
    }

    const versionNum = template.version?.versionNumber;
    const version =
      versionNum !== undefined && !Number.isNaN(Number(versionNum)) && Number(versionNum) >= 1
        ? Number(versionNum)
        : 1;

    const values = buildConfigValues(rawValues);

    return sanitizeRemoteConfigDocument(
      {
        version,
        ttlSeconds: this.options.ttlSeconds ?? 3600,
        audience,
        values,
      },
      audience,
      {
        version,
        ttlSeconds: this.options.ttlSeconds ?? 3600,
      },
    );
  }
}
