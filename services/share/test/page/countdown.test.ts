import { describe, expect, it } from 'vitest';
import vectors from '../fixtures/countdown-vectors.json';
import { cells, compute, ordinal, summaryText } from '../../src/page/countdown';
import type { SharePayload } from '../../src/page/types';

interface Vector {
  name: string;
  timeZone: string | null;
  targetDate: string;
  targetTime: string | null;
  recurrence: SharePayload['recurrence'];
  unitMode: SharePayload['unitMode'];
  viewerZone: string | null;
  nowInstant: string;
  expectedTargetInstant: string;
  expectedBreakdown: Record<string, string | number | null>;
}

function payloadOf(v: Vector): SharePayload {
  return {
    v: 1,
    title: v.name,
    emoji: null,
    targetDate: v.targetDate,
    targetTime: v.targetTime,
    timeZone: v.timeZone,
    unitMode: v.unitMode,
    recurrence: v.recurrence,
    theme: { paletteId: 'blue', cardStyle: 'glass', typography: 'modern', gradient: null },
  };
}

describe('countdown golden vectors', () => {
  for (const v of vectors as unknown as Vector[]) {
    it(v.name, () => {
      const state = compute(payloadOf(v), Date.parse(v.nowInstant), v.viewerZone);
      expect(new Date(state.targetMs).toISOString().replace('.000Z', 'Z')).toBe(v.expectedTargetInstant);
      const actual: Record<string, unknown> = { ...state, direction: state.direction };
      for (const [key, expected] of Object.entries(v.expectedBreakdown)) {
        expect(actual[key], key).toBe(expected);
      }
    });
  }
});

describe('summary and cells', () => {
  const p = (over: Partial<SharePayload>): SharePayload => ({
    v: 1, title: 't', emoji: null, targetDate: '2027-01-01', targetTime: null, timeZone: 'UTC', unitMode: 'auto',
    recurrence: { type: 'none', originalYear: null, days: null },
    theme: { paletteId: 'blue', cardStyle: 'glass', typography: 'modern', gradient: null }, ...over,
  });
  const now = Date.parse('2026-10-10T15:00:00Z');

  it('days over 48 hours', () => {
    const s = compute(p({}), now, null);
    expect(summaryText(s, 'auto')).toBe('82 days to go');
    expect(cells(s, 'auto').map((c) => c.unit)).toEqual(['days', 'hours', 'minutes', 'seconds']);
  });
  it('hours under 48 hours', () => {
    const s = compute(p({ targetDate: '2026-10-11', targetTime: '20:30:15' }), now, null);
    expect(summaryText(s, 'auto')).toBe('29h 30m 15s to go');
    expect(cells(s, 'auto').map((c) => c.unit)).toEqual(['hours', 'minutes', 'seconds']);
  });
  it('calendar mode', () => {
    const s = compute(p({ targetDate: '2030-06-01' }), now, null);
    expect(summaryText(s, 'calendar')).toBe('3 years, 7 months, 21 days to go');
  });
  it('since', () => {
    const s = compute(p({ targetDate: '2026-10-09' }), now, null);
    expect(summaryText(s, 'days')).toBe('1 day ago');
  });
  it('today after the time has passed', () => {
    const s = compute(p({ targetDate: '2026-10-10', targetTime: '09:00:00' }), now, null);
    expect(s.direction).toBe('today');
    expect(summaryText(s, 'auto')).toBe('Today');
    expect(cells(s, 'auto')).toEqual([]);
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '112th']);
  });
});
