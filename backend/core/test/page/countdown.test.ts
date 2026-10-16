import { describe, expect, it } from 'vitest';
import { readCoreJson } from '../../src/node/contract-files.ts';
import { cells, compute, ordinal, summaryText } from '../../src/page/countdown.ts';
import type { CountdownEvent, UnitMode } from '../../src/page/countdown.ts';
import type { SharePayload } from '../../src/page/types.ts';

interface Vector {
  name: string;
  timeZone: string | null;
  targetDate: string;
  targetTime: string | null;
  recurrence: NonNullable<CountdownEvent['recurrence']> | null;
  viewerZone: string | null;
  nowInstant: string;
  expected: Record<string, unknown> & { targetInstant: string; units: Record<UnitMode, unknown> };
}

const file = readCoreJson<{ vectors: Vector[] }>('web/test/countdown-vectors.json');

function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

function payloadOf(v: Vector): SharePayload {
  return {
    v: 1,
    title: v.name,
    emoji: null,
    targetDate: v.targetDate,
    targetTime: v.targetTime,
    timeZone: v.timeZone,
    unitMode: 'auto',
    recurrence: v.recurrence ? {
      type: v.recurrence.type as NonNullable<SharePayload['recurrence']>['type'],
      originalYear: v.recurrence.originalYear ?? null,
      days: v.recurrence.days ?? null,
    } : null,
    theme: { paletteId: 'blue', cardStyle: 'glass', typography: 'modern', gradient: null },
  };
}

describe('countdown golden vectors from src/page/countdown', () => {
  for (const v of file.vectors) {
    it(v.name, () => {
      const state = compute(payloadOf(v), Date.parse(v.nowInstant), v.viewerZone);
      expect(isoSeconds(state.targetMs)).toBe(v.expected.targetInstant);
    });
  }
});

describe('summary and cells via src/page/countdown', () => {
  const p = (over: Partial<SharePayload>): SharePayload => ({
    v: 1,
    title: 't',
    emoji: null,
    targetDate: '2027-01-01',
    targetTime: null,
    timeZone: 'UTC',
    unitMode: 'auto',
    recurrence: { type: 'none', originalYear: null, days: null },
    theme: { paletteId: 'blue', cardStyle: 'glass', typography: 'modern', gradient: null },
    ...over,
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
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '112th',
    ]);
  });
});
