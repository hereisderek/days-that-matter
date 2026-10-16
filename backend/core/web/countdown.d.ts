// Types of countdown.js for the core and its tests.

export type UnitMode = 'auto' | 'days' | 'weeks' | 'hours' | 'calendar' | 'workdays';

export interface CountdownEvent {
  readonly targetDate: string;
  readonly targetTime?: string | null;
  readonly timeZone?: string | null;
  readonly recurrence?: { readonly type: string; readonly originalYear?: number | null; readonly days?: number | null } | null;
  readonly unitMode?: UnitMode | null;
}

export interface LocalDate {
  readonly y: number;
  readonly mo: number;
  readonly d: number;
}

export interface CountdownState {
  readonly zone: string;
  readonly occurrenceDate: string;
  readonly targetMs: number;
  readonly direction: 'until' | 'since' | 'today';
  readonly isToday: boolean;
  readonly isPast: boolean;
  readonly upcoming: boolean;
  readonly totalDays: number;
  readonly totalHours: number;
  readonly totalMinutes: number;
  readonly totalSeconds: number;
  readonly years: number;
  readonly months: number;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly anniversary: number | null;
  readonly workdays: number;
}

export type UnitValue =
  | { readonly kind: 'days'; readonly days: number }
  | { readonly kind: 'hoursMinutes'; readonly hours: number; readonly minutes: number }
  | { readonly kind: 'weeksDays'; readonly weeks: number; readonly days: number }
  | { readonly kind: 'hours'; readonly hours: number }
  | { readonly kind: 'calendar'; readonly years: number; readonly months: number; readonly days: number }
  | { readonly kind: 'workdays'; readonly workdays: number };

export interface Cell {
  readonly unit: string;
  readonly value: number;
}

export const UNIT_MODES: readonly UnitMode[];
export function compute(event: CountdownEvent, nowMs: number, viewerZone: string | null): CountdownState;
export function unitValue(state: CountdownState, unitMode: UnitMode | null | undefined): UnitValue;
export function workdays(today: LocalDate, occurrence: LocalDate): number;
export function nextOccurrenceDate(event: CountdownEvent, today: LocalDate): LocalDate;
export function summaryText(state: CountdownState, unitMode: UnitMode | null | undefined): string;
export function cells(state: CountdownState, unitMode: UnitMode | null | undefined): Cell[];
export function ordinal(n: number): string;

export interface CardDisplay {
  readonly hero: Cell | null;
  readonly rest: Cell[];
  readonly suffix: 'to go' | 'ago';
}

export function unitLabel(unit: string, value: number): string;
export function cellText(cell: Cell, index: number, locale?: string): string;
export function display(state: CountdownState, unitMode: UnitMode | null | undefined): CardDisplay;
