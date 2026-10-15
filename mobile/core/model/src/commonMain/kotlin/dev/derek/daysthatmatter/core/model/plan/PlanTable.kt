package dev.derek.daysthatmatter.core.model.plan

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.time.Instant

/**
 * An account's plan. Guests follow [Free] on the device. [PremiumPlus] is reserved: it includes
 * everything in [Premium] and is not sold until features are assigned to it.
 */
@Serializable
enum class Plan(private val rank: Int) {
    @SerialName("free") Free(0),
    @SerialName("premium") Premium(1),
    @SerialName("premium_plus") PremiumPlus(2),
    ;

    /** True when this plan is at least [other]. */
    fun atLeast(other: Plan): Boolean = rank >= other.rank

    companion object {
        /** The highest of [plans], or [Free] when there is none. */
        fun highest(plans: Iterable<Plan>): Plan = plans.maxByOrNull { it.rank } ?: Free
    }
}

/**
 * Gated features and counted limits. [key] is the API value (`details.feature` of
 * `402 premium_required`) and the key column of docs/features/premium/SPEC.md section 2.
 */
@Serializable
enum class Feature(val key: String) {
    /** Owned events; counts the owner's events, archived ones included. */
    @SerialName("events") Events("events"),

    /** Photo backdrops in use, still or animated, counted for the uploader. */
    @SerialName("photos") Photos("photos"),

    /** Animated photos in use, counted for the uploader. */
    @SerialName("animated_backdrop") AnimatedBackdrop("animated_backdrop"),

    /** Premium built-in tracks. Not counted: a plan includes them or not. */
    @SerialName("premium_audio") PremiumAudio("premium_audio"),

    /** Custom audio files in the uploader's library or used by a day. */
    @SerialName("custom_audio") CustomAudio("custom_audio"),

    /** Events where the account set a Spotify link. */
    @SerialName("spotify_events") SpotifyEvents("spotify_events"),
}

/**
 * The limits of one plan. A limit of 0 means the plan does not include the feature; null means no
 * separate limit.
 */
data class PlanLimits(
    val ownedEvents: Int?,
    val photos: Int?,
    val animatedPhotos: Int?,
    val premiumTracks: Boolean,
    val customAudio: Int?,
    val spotifyEvents: Int?,
) {
    /** The limit for [feature]: 0 = not included, null = no limit. */
    fun limit(feature: Feature): Int? = when (feature) {
        Feature.Events -> ownedEvents
        Feature.Photos -> photos
        Feature.AnimatedBackdrop -> animatedPhotos
        Feature.PremiumAudio -> if (premiumTracks) null else 0
        Feature.CustomAudio -> customAudio
        Feature.SpotifyEvents -> spotifyEvents
    }

    /** True when the plan lets an account add [feature] at all. */
    fun includes(feature: Feature): Boolean = limit(feature) != 0
}

/**
 * The plan table: the one source of every plan limit for the app and the backend.
 * Any change here updates docs/features/premium/SPEC.md section 2 in the same PR (AGENTS.md rule 7).
 */
object PlanTable {
    val FREE: PlanLimits = PlanLimits(
        ownedEvents = 10,
        photos = 5,
        animatedPhotos = 0,
        premiumTracks = false,
        customAudio = 0,
        spotifyEvents = 3,
    )

    val PREMIUM: PlanLimits = PlanLimits(
        ownedEvents = 500,
        photos = 300,
        animatedPhotos = 30,
        premiumTracks = true,
        customAudio = 20,
        spotifyEvents = null,
    )

    /** As Premium until features are assigned to Premium Plus. */
    val PREMIUM_PLUS: PlanLimits = PREMIUM

    fun limits(plan: Plan): PlanLimits = when (plan) {
        Plan.Free -> FREE
        Plan.Premium -> PREMIUM
        Plan.PremiumPlus -> PREMIUM_PLUS
    }
}

/**
 * A period in which an account holds a plan: an active or grace store purchase, or an operator grant.
 * [startsAt] null = already started; [endsAt] null = no end known.
 */
data class PlanPeriod(val plan: Plan, val startsAt: Instant? = null, val endsAt: Instant? = null) {
    fun isActive(now: Instant): Boolean = (startsAt == null || startsAt <= now) && (endsAt == null || now < endsAt)
}

/** Plan rules of design D14 that do not depend on a store. */
object Plans {
    /**
     * The account's plan at [now]: the highest of its active purchases and grants. When the last one
     * ends the plan is free again; content added before stays (the lapsed-plan rule).
     */
    fun effectivePlan(periods: Iterable<PlanPeriod>, now: Instant): Plan =
        Plan.highest(periods.filter { it.isActive(now) }.map { it.plan })

    /** The stored `accounts.plan` and `plan_expires_at`: the plan counts as free once [expiresAt] has passed. */
    fun effectivePlan(plan: Plan, expiresAt: Instant?, now: Instant): Plan =
        if (expiresAt != null && now >= expiresAt) Plan.Free else plan
}
