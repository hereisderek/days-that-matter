export interface BlobObject {
  readonly body: ReadableStream<Uint8Array>;
  readonly contentType: string;
  readonly size: number;
}

/** Media and audio files: R2, a directory, Vercel Blob or Cloud Storage (BACKEND.md section 4). */
export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Streams a file, for access-checked audio. Null when there is none. */
  get(key: string): Promise<BlobObject | null>;
  /** Deletes files; unknown keys are ignored. */
  delete(keys: readonly string[]): Promise<void>;
  /** The public URL of a backdrop file on the media origin. */
  publicUrl(key: string): string;
}
