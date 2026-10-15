// Blob keys of media rows (BACKEND.md section 6.1): backdrops at `m/{id}.{ext}`, custom audio at `a/{id}.m4a`.
import type { MediaRef } from '../ports/store.ts';

const EXTENSIONS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4' };

export function mediaKey(media: MediaRef): string {
  if (media.kind === 'audio') return `a/${media.id}.m4a`;
  return `m/${media.id}.${EXTENSIONS[media.contentType] ?? 'bin'}`;
}
