// Countdown parity (task 2.7 of pluggable-backend-live-sharing, task 1.2 of design-v2-features):
// countdown.js must give exactly what the Kotlin engine wrote into countdown-vectors.json.
import { describe, expect, it } from 'vitest';
import { readCoreJson } from '../../src/node/contract-files.ts';
import { UNIT_MODES, cells, compute, ordinal, summaryText, unitValue, workdays } from '../../web/countdown.js';
import type { CountdownEvent, UnitMode } from '../../web/countdown.js';

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

describe('countdown parity vectors', () => {
  it('cover every unit mode, workdays and sub-second clocks', () => {
    expect(file.vectors.length).toBeGreaterThanOrEqual(59);
    for (const v of file.vectors) expect(Object.keys(v.expected.units).sort()).toEqual([...UNIT_MODES].sort());
    expect(file.vectors.every((v) => typeof v.expected['workdays'] === 'number')).toBe(true);
    expect(file.vectors.filter((v) => /\.\d+Z$/.test(v.nowInstant)).length).toBeGreaterThanOrEqual(9);
  });

  for (const v of file.vectors) {
    it(v.name, () => {
      const event: CountdownEvent = { targetDate: v.targetDate, targetTime: v.targetTime, timeZone: v.timeZone, recurrence: v.recurrence };
      const state = compute(event, Date.parse(v.nowInstant), v.viewerZone);
      const { targetInstant, units, ...rest } = v.expected;
      expect(isoSeconds(state.targetMs), 'targetInstant').toBe(targetInstant);
      const actual = state as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(rest)) expect(actual[key], key).toEqual(value);
      for (const mode of UNIT_MODES) expect(unitValue(state, mode), `units.${mode}`).toEqual(units[mode]);
    });
  }
});

describe('workdays', () => {
  it('counts Monday to Friday after today up to the occurrence', () => {
    // 12 October 2026 is a Monday.
    expect(workdays({ y: 2026, mo: 10, d: 12 }, { y: 2026, mo: 10, d: 23 })).toBe(9);
    expect(workdays({ y: 2026, mo: 10, d: 12 }, { y: 2026, mo: 10, d: 17 })).toBe(4);
    expect(workdays({ y: 2026, mo: 10, d: 12 }, { y: 2026, mo: 10, d: 9 })).toBe(1);
    expect(workdays({ y: 2026, mo: 10, d: 12 }, { y: 2026, mo: 10, d: 12 })).toBe(0);
    expect(workdays({ y: 1969, mo: 12, d: 26 }, { y: 1970, mo: 1, d: 5 })).toBe(6);
  });
});

describe('summary and cells', () => {
  const event = (over: Partial<CountdownEvent>): CountdownEvent => ({
    targetDate: '2027-01-01', targetTime: null, timeZone: 'UTC', recurrence: { type: 'none' }, ...over,
  });
  const now = Date.parse('2026-10-10T15:00:00Z');

  it('auto shows days over 48 hours', () => {
    const s = compute(event({}), now, null);
    expect(summaryText(s, 'auto')).toBe('82 days to go');
    expect(cells(s, 'auto').map((c) => c.unit)).toEqual(['days', 'hours', 'minutes', 'seconds']);
  });
  it('auto shows hours under 48 hours', () => {
    const s = compute(event({ targetDate: '2026-10-11', targetTime: '20:30:15' }), now, null);
    expect(summaryText(s, 'auto')).toBe('29h 30m 15s to go');
    expect(cells(s, 'auto').map((c) => c.unit)).toEqual(['hours', 'minutes', 'seconds']);
  });
  it('weeks', () => {
    const s = compute(event({}), now, null);
    expect(summaryText(s, 'weeks')).toBe('11 weeks, 5 days to go');
    expect(cells(s, 'weeks').map((c) => c.unit)).toEqual(['weeks', 'days', 'hours', 'minutes', 'seconds']);
    const short = compute(event({ targetDate: '2026-10-14' }), now, null);
    expect(summaryText(short, 'weeks')).toBe('3 days to go');
  });
  it('hours', () => {
    const s = compute(event({ targetDate: '2026-10-12' }), now, null);
    expect(summaryText(s, 'hours')).toBe('33 hours to go');
    expect(cells(s, 'hours')[0]).toEqual({ unit: 'hours', value: 33 });
  });
  it('calendar', () => {
    const s = compute(event({ targetDate: '2030-06-01' }), now, null);
    expect(summaryText(s, 'calendar')).toBe('3 years, 7 months, 21 days to go');
    expect(cells(s, 'calendar').map((c) => c.unit)).toEqual(['years', 'months', 'days', 'hours', 'minutes', 'seconds']);
  });
  it('workdays', () => {
    const s = compute(event({ targetDate: '2026-10-23' }), Date.parse('2026-10-12T08:00:00Z'), null);
    expect(summaryText(s, 'workdays')).toBe('9 workdays to go');
    expect(cells(s, 'workdays')).toEqual([{ unit: 'workdays', value: 9 }]);
  });
  it('days and since', () => {
    const s = compute(event({ targetDate: '2026-10-09' }), now, null);
    expect(summaryText(s, 'days')).toBe('1 day ago');
    expect(summaryText(s, null)).toBe('39h 00m 00s ago');
  });
  it('today, before and after the time', () => {
    const later = compute(event({ targetDate: '2026-10-10', targetTime: '20:00:00' }), now, null);
    expect(cells(later, 'calendar').map((c) => c.unit)).toEqual(['hours', 'minutes', 'seconds']);
    const passed = compute(event({ targetDate: '2026-10-10', targetTime: '09:00:00' }), now, null);
    expect(passed.direction).toBe('today');
    expect(summaryText(passed, 'auto')).toBe('Today');
    expect(cells(passed, 'auto')).toEqual([]);
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '112th']);
  });
  it('has no DOM access at module load', async () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    const mod = await import('../../web/countdown.js');
    expect(typeof mod.compute).toBe('function');
  });
});
