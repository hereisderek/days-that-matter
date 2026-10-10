/** Share payload v1 as the page reads it (docs/architecture/SHARE_SERVICE.md section 6.2). */
export interface SharePayload {
  v: number;
  title: string;
  emoji: string | null;
  targetDate: string;
  targetTime: string | null;
  timeZone: string | null;
  unitMode: 'auto' | 'days' | 'calendar';
  recurrence: {
    type: 'none' | 'yearly' | 'monthly' | 'weekly' | 'customDays';
    originalYear: number | null;
    days: number | null;
  };
  theme: {
    paletteId: string;
    cardStyle: string;
    typography: string;
    gradient: [string, string] | null;
  };
}

export interface PageShare {
  shareToken: string;
  schemaVersion: number;
  payload: SharePayload;
}
