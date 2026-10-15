import type { LiveMessage, LiveMode } from '../contract/index.ts';

/** Change notices to open pages and apps (design D7). In `poll` mode publishing does nothing. */
export interface LiveHub {
  readonly mode: LiveMode;
  publish(eventId: string, message: LiveMessage): Promise<void>;
}

/** The hub of a `poll` deployment. */
export const pollHub: LiveHub = { mode: 'poll', publish: async () => {} };
