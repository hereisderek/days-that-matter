// Plan rules the core applies on top of the generated plan table (BACKEND.md sections 8 and 11.1).
import { FEATURES, planLimit } from '../contract/index.ts';

import type { Feature, Plan } from '../contract/index.ts';
import type { AccountRecord, AccountUsage } from '../ports/store.ts';
import type { RemoteConfigDocument } from '../remote-config/types.ts';

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

/**
 * Resolves the active limit for [feature] on [plan] using the provided remote-config document.
 * If the document is missing or the value is out of range, falls back to the compiled-in limit.
 */
export function resolvePlanLimit(
  doc: RemoteConfigDocument | null | undefined,
  plan: Plan,
  feature: Feature,
): number | null {
  if (doc && doc.values) {
    const key = `plans.${plan}.${feature}`;
    const entry = doc.values[key];
    if (entry !== undefined && entry !== null) {
      const val = entry.value;
      if (val === null) {
        if (plan !== 'free') return null;
      } else if (typeof val === 'number' && Number.isSafeInteger(val) && val >= 0) {
        return val;
      }
    }
  }
  return planLimit(plan, feature);
}

/** Every feature's limit for `plan`: 0 = not included, null = no limit. */
export function limitsByFeature(plan: Plan, doc?: RemoteConfigDocument | null): Record<Feature, number | null> {
  return Object.fromEntries(FEATURES.map((f) => [f, resolvePlanLimit(doc, plan, f)])) as Record<Feature, number | null>;
}

