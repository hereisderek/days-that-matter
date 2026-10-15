// Plan rules the core applies on top of the generated plan table (BACKEND.md sections 8 and 11.1).
import { FEATURES, planLimit } from '../contract/index.ts';
import type { Feature, Plan } from '../contract/index.ts';
import type { AccountRecord, AccountUsage } from '../ports/store.ts';

/** The plan that applies at `now`: a plan whose `plan_expires_at` has passed counts as free. */
export function effectivePlan(account: AccountRecord, now: number): Plan {
  return account.planExpiresAt !== null && account.planExpiresAt <= now ? 'free' : account.plan;
}

/** Counted features with what the account uses, keyed by their API names. */
export function usageByFeature(usage: AccountUsage): Partial<Record<Feature, number>> {
  return {
    events: usage.events,
    photos: usage.photos,
    animated_backdrop: usage.animatedBackdrop,
    custom_audio: usage.customAudio,
    spotify_events: usage.spotifyEvents,
  };
}

/** Every feature's limit for `plan`: 0 = not included, null = no limit. */
export function limitsByFeature(plan: Plan): Record<Feature, number | null> {
  return Object.fromEntries(FEATURES.map((f) => [f, planLimit(plan, f)])) as Record<Feature, number | null>;
}
