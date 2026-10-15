// The error envelope of BACKEND.md section 7.1: {"error": {"code", "message", "details"}}.
// Codes and their HTTP status come from the contract (errors.json, generated from :core:model).
// Messages are fixed texts: they never echo user values, tokens or SQL.
import { ERROR_STATUS } from '../contract/index.ts';
import type { ApiErrorCode, ApiErrorResponse } from '../contract/index.ts';
import type { Json } from '../rules/merge.ts';
import { jsonResponse } from './types.ts';
import type { HttpResponse } from './types.ts';

export type ErrorDetails = Readonly<Record<string, Json>>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ErrorDetails | null;
  readonly headers: Readonly<Record<string, string>>;

  constructor(code: ApiErrorCode, message: string, details: ErrorDetails | null = null, headers: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    this.headers = headers;
  }

  body(): ApiErrorResponse {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export function errorResponse(e: ApiError): HttpResponse {
  return jsonResponse(e.status, e.body(), e.headers);
}

/** One constructor, so unknown, malformed and purged ids and tokens give byte-identical 404s. */
export const notFound = (): ApiError => new ApiError('not_found', 'Not found');

export const invalidPayload = (field: string, reason: string, details?: ErrorDetails): ApiError =>
  new ApiError('invalid_payload', `${field === '' ? '(body)' : field}: ${reason}`, { field, ...details });

export const payloadTooLarge = (): ApiError => new ApiError('payload_too_large', 'Body too large');

export const unsupportedMediaType = (): ApiError => new ApiError('unsupported_media_type', 'Unsupported content type');

export const internalError = (requestId: string): ApiError =>
  new ApiError('internal_error', 'Internal error', { requestId });

export const serviceUnavailable = (): ApiError =>
  new ApiError('service_unavailable', 'Service temporarily unavailable', null, { 'Retry-After': '60' });
