// Typed view of public/assets/countdown.js, which the browser loads as well.
// The JS file is the single implementation, so the server text and the page agree.
// @ts-expect-error the module has no declaration file (the file is a static asset)
import * as raw from '../../public/assets/countdown.js';
import type { SharePayload } from './types';

export interface CountdownState {
  zone: string;
  occurrenceDate: string;
  targetMs: number;
  direction: 'until' | 'since' | 'today';
  isToday: boolean;
  isPast: boolean;
  upcoming: boolean;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  anniversary: number | null;
}

export interface Cell {
  unit: 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';
  value: number;
}

export const compute = raw.compute as (payload: SharePayload, nowMs: number, viewerZone?: string | null) => CountdownState;
export const summaryText = raw.summaryText as (state: CountdownState, unitMode?: string) => string;
export const cells = raw.cells as (state: CountdownState, unitMode?: string) => Cell[];
export const ordinal = raw.ordinal as (n: number) => string;
