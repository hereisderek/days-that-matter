// Typed view of web/countdown.js for page rendering in the core.
import {
  cells as rawCells,
  cellText as rawCellText,
  compute as rawCompute,
  display as rawDisplay,
  ordinal as rawOrdinal,
  summaryText as rawSummaryText,
  unitLabel as rawUnitLabel,
  UNIT_MODES as rawUnitModes,
} from '../../web/countdown.js';
import type { CardDisplay, Cell, CountdownEvent, CountdownState, UnitMode } from '../../web/countdown.d.ts';

export type { CardDisplay, Cell, CountdownEvent, CountdownState, UnitMode };
export const UNIT_MODES = rawUnitModes;
export const compute = rawCompute;
export const summaryText = rawSummaryText;
export const cells = rawCells;
export const cellText = rawCellText;
export const display = rawDisplay;
export const ordinal = rawOrdinal;
export const unitLabel = rawUnitLabel;
