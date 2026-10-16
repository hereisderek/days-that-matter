// Typed view of web/countdown.js for page rendering in the core.
import {
  cells as rawCells,
  compute as rawCompute,
  ordinal as rawOrdinal,
  summaryText as rawSummaryText,
  UNIT_MODES as rawUnitModes,
} from '../../web/countdown.js';
import type { Cell, CountdownEvent, CountdownState, UnitMode } from '../../web/countdown.d.ts';

export type { Cell, CountdownEvent, CountdownState, UnitMode };
export const UNIT_MODES = rawUnitModes;
export const compute = rawCompute;
export const summaryText = rawSummaryText;
export const cells = rawCells;
export const ordinal = rawOrdinal;
