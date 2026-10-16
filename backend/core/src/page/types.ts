import type { PublicEvent } from '../contract/index.ts';

/** Share payload v1 as the page reads it (docs/architecture/SHARE_SERVICE.md section 6.2). */
export interface SharePayload {
  v?: number;
  title: string;
  emoji?: string | null;
  targetDate: string;
  targetTime?: string | null;
  timeZone?: string | null;
  unitMode?: 'auto' | 'days' | 'calendar' | 'weeks' | 'hours' | 'workdays';
  recurrence?: {
    type: 'none' | 'yearly' | 'monthly' | 'weekly' | 'customDays';
    originalYear?: number | null;
    days?: number | null;
  } | null;
  theme?: {
    paletteId: string;
    cardStyle: string;
    typography: string;
    gradient?: [string, string] | string[] | null;
  };
  backdrop?: PublicEvent['backdrop'];
  audio?: PublicEvent['audio'];
}

export interface PageShare {
  shareToken: string;
  schemaVersion?: number;
  payload?: SharePayload;
  event?: PublicEvent;
}
