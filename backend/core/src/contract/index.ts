// The rules the core takes from :core:model, through the generated files in backend/core/contract/
// (design D1). Types come from api.ts, generated from api.schema.json; values come from the JSON files.
// The assignments below fail to compile when the JSON and the schema disagree (for example an error
// code without a status, or a plan without limits).
import errorsJson from '../../contract/errors.json' with { type: 'json' };
import limitsJson from '../../contract/limits.json' with { type: 'json' };
import plansJson from '../../contract/plans.json' with { type: 'json' };
import type { ApiErrorCode, Feature, Plan } from './api.ts';

export type * from './api.ts';

/** HTTP status of every API error code (BACKEND.md section 7.5). */
export const ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = errorsJson.codes;

/** Plan limits: 0 = the plan does not include the feature, null = no limit (BACKEND.md section 11.1). */
export const PLAN_LIMITS: Readonly<Record<Plan, Readonly<Record<Feature, number | null>>>> = plansJson.limits;

export const PLANS: readonly Plan[] = plansJson.plans as Plan[];
export const FEATURES: readonly Feature[] = plansJson.features as Feature[];

/** Fixed limits for every plan (BACKEND.md section 11.2), named as in `:core:model` `Limits`. */
export const LIMITS: Readonly<typeof limitsJson.limits> = limitsJson.limits;

/** The limit of [feature] for [plan]: 0 = not included, null = no limit. */
export function planLimit(plan: Plan, feature: Feature): number | null {
  return PLAN_LIMITS[plan][feature];
}
