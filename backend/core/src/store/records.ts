// Rules every Store implementation shares, so SqlStore, MemoryStore and later FirestoreStore derive
// the same columns and outcomes.
import type { Json, JsonObject } from '../rules/merge.ts';
import { isJsonObject } from '../rules/merge.ts';
import type { AudioKind } from '../ports/store.ts';

export interface AudioColumns {
  readonly audioKind: AudioKind | null;
  readonly audioSetBy: string | null;
  readonly audioMediaId: string | null;
}

/** The audio columns of an event whose `audio` field was set by `setter` (BACKEND.md sections 6.1 and 10.4). */
export function audioColumns(doc: JsonObject, setter: string): AudioColumns {
  const audio = doc['audio'];
  if (!isJsonObject(audio)) return { audioKind: null, audioSetBy: null, audioMediaId: null };
  const kind = audio['kind'];
  const audioKind = kind === 'library' || kind === 'custom' || kind === 'spotify' ? kind : null;
  const mediaId = audioKind === 'custom' && typeof audio['mediaId'] === 'string' ? audio['mediaId'] : null;
  return { audioKind, audioSetBy: audioKind === null ? null : setter, audioMediaId: mediaId };
}

/** Attempts of an optimistic write before the store reports StoreBusyError. */
export const WRITE_ATTEMPTS = 20;

/** A deep copy of a JSON value, so callers never share a store's state. */
export function copyJson<T extends Json>(value: T): T {
  return structuredClone(value);
}
