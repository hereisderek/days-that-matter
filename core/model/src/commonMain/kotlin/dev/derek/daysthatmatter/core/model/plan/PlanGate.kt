package dev.derek.daysthatmatter.core.model.plan

import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.api.MediaKind
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.Backdrop
import dev.derek.daysthatmatter.core.model.event.BackdropKind

/**
 * What a writer's account has in use, counted the way the plan table counts
 * (docs/features/premium/SPEC.md section 2): owned events count the owner's events, the rest count
 * what the account added.
 */
data class UsageCounts(
    val ownedEvents: Int = 0,
    val photos: Int = 0,
    val animatedPhotos: Int = 0,
    val customAudio: Int = 0,
    val spotifyEvents: Int = 0,
) {
    /** The count for [feature]; 0 for [Feature.PremiumAudio], which is not counted. */
    fun of(feature: Feature): Int = when (feature) {
        Feature.Events -> ownedEvents
        Feature.Photos -> photos
        Feature.AnimatedBackdrop -> animatedPhotos
        Feature.PremiumAudio -> 0
        Feature.CustomAudio -> customAudio
        Feature.SpotifyEvents -> spotifyEvents
    }
}

/** What a change needs from the writer's plan. */
sealed interface PlanNeed {
    /** The plan must include [feature] (for example a Premium track, or a library file on a day). */
    data class Includes(val feature: Feature) : PlanNeed

    /** The change adds [amount] to the writer's count of [feature]. */
    data class Adds(val feature: Feature, val amount: Int = 1) : PlanNeed
}

/** Outcome of a gate check. */
sealed interface GateResult {
    data object Allowed : GateResult

    /** A higher plan allows it: the app shows the paywall, the backend answers `402 premium_required`. */
    data class PremiumRequired(val feature: Feature) : GateResult

    /** No plan raises this limit: the app says the limit is reached, the backend answers `429 quota_exceeded`. */
    data class QuotaExceeded(val feature: Feature) : GateResult

    val errorCode: ApiErrorCode?
        get() = when (this) {
            Allowed -> null
            is PremiumRequired -> ApiErrorCode.PremiumRequired
            is QuotaExceeded -> ApiErrorCode.QuotaExceeded
        }
}

/**
 * The gate check used by the app before saving and by the backend on writes (design D14).
 *
 * Gating follows the writer's own plan. Only additions are checked: counts already above a limit
 * (after a plan lapsed or a grant ended) keep working, and a change that adds nothing is allowed.
 */
object PlanGate {
    fun check(plan: Plan, usage: UsageCounts, needs: List<PlanNeed>): GateResult {
        val limits = PlanTable.limits(plan)
        for (need in needs) {
            when (need) {
                is PlanNeed.Includes ->
                    if (!limits.includes(need.feature)) return GateResult.PremiumRequired(need.feature)
                is PlanNeed.Adds -> {
                    if (need.amount <= 0) continue
                    val limit = limits.limit(need.feature) ?: continue
                    val wanted = usage.of(need.feature) + need.amount
                    if (wanted > limit) {
                        return if (higherPlanAllows(plan, need.feature, wanted)) {
                            GateResult.PremiumRequired(need.feature)
                        } else {
                            GateResult.QuotaExceeded(need.feature)
                        }
                    }
                }
            }
        }
        return GateResult.Allowed
    }

    /** Needs of creating an event owned by the writer. */
    fun needsForNewEvent(): List<PlanNeed> = listOf(PlanNeed.Adds(Feature.Events))

    /** Needs of an upload of [kind] by the writer (BACKEND.md section 10.1 step 5). */
    fun needsForUpload(kind: MediaKind): List<PlanNeed> = when (kind) {
        MediaKind.Still -> listOf(PlanNeed.Adds(Feature.Photos))
        MediaKind.Motion -> listOf(PlanNeed.Adds(Feature.AnimatedBackdrop))
        MediaKind.Audio -> listOf(PlanNeed.Adds(Feature.CustomAudio))
    }

    /**
     * Needs of changing an event's audio from [before] to [after].
     *
     * @param writerSetBefore true when [before] is a Spotify link the writer set, so replacing it with
     *   another Spotify link does not add to the writer's Spotify count.
     * @param isPremiumTrack whether a built-in track id needs `premium_audio`.
     */
    fun needsForAudio(
        before: Audio?,
        after: Audio?,
        writerSetBefore: Boolean,
        isPremiumTrack: (String) -> Boolean,
    ): List<PlanNeed> {
        if (after == before) return emptyList()
        return when (after) {
            null -> emptyList()
            is Audio.Library ->
                if (isPremiumTrack(after.trackId)) listOf(PlanNeed.Includes(Feature.PremiumAudio)) else emptyList()
            is Audio.Custom -> listOf(PlanNeed.Includes(Feature.CustomAudio))
            is Audio.Spotify ->
                if (before is Audio.Spotify && writerSetBefore) emptyList() else listOf(PlanNeed.Adds(Feature.SpotifyEvents))
        }
    }

    /** Needs of changing an event's backdrop: saving a new animated photo needs a plan that includes it. */
    fun needsForBackdrop(before: Backdrop?, after: Backdrop?): List<PlanNeed> {
        if (after == null || after.kind != BackdropKind.Animated) return emptyList()
        val sameMotion = before?.kind == BackdropKind.Animated && before.motionId == after.motionId
        return if (sameMotion) emptyList() else listOf(PlanNeed.Includes(Feature.AnimatedBackdrop))
    }

    private fun higherPlanAllows(plan: Plan, feature: Feature, wanted: Int): Boolean =
        Plan.entries.any { other ->
            other != plan && other.atLeast(plan) && PlanTable.limits(other).limit(feature).let { it == null || wanted <= it }
        }
}
