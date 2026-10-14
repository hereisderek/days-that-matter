/** Current time; injected so tests control it. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  nowMs(): number;
}

export const systemClock: Clock = { nowMs: () => Date.now() };

/** Unix seconds, the unit of every stored time (BACKEND.md section 6.1). */
export function nowSeconds(clock: Clock): number {
  return Math.floor(clock.nowMs() / 1000);
}
