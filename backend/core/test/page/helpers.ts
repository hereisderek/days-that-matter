import type { PageShare, SharePayload } from '../../src/page/types.ts';

export const NOW_MS = Date.parse('2026-10-10T15:00:00Z');
export const TOKEN = 'Zq3u8Yc0Vf1o7e2N9a4Kxw';

export function payload(over: Partial<SharePayload> = {}): SharePayload {
  return {
    v: 1,
    title: 'Our wedding',
    emoji: '\u{1F48D}',
    targetDate: '2027-06-12',
    targetTime: '16:30:00',
    timeZone: 'Europe/Paris',
    unitMode: 'auto',
    recurrence: { type: 'none', originalYear: null, days: null },
    theme: { paletteId: 'violet', cardStyle: 'glass', typography: 'modern', gradient: ['#8B5CF6', '#3B82F6'] },
    ...over,
  };
}

export function share(over: Partial<SharePayload> = {}): PageShare {
  return { shareToken: TOKEN, schemaVersion: 1, payload: payload(over) };
}

/** Text between the opening and closing tag of the JSON blob. */
export function blobOf(page: string): string {
  const m = /<script type="application\/json" id="share-data">([\s\S]*?)<\/script>/.exec(page);
  if (!m) throw new Error('no share-data blob');
  return m[1] as string;
}
