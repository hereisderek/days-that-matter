package dev.derek.daysthatmatter.core.model.plan

import dev.derek.daysthatmatter.core.model.ModelJson
import dev.derek.daysthatmatter.core.model.api.ApiErrorCode
import dev.derek.daysthatmatter.core.model.api.MediaKind
import dev.derek.daysthatmatter.core.model.event.Audio
import dev.derek.daysthatmatter.core.model.event.Backdrop
import dev.derek.daysthatmatter.core.model.event.BackdropKind
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.days
import kotlin.time.Instant

/** The plan table against docs/features/premium/SPEC.md section 2, row by row, and the gate check. */
class PlanTableTest {
    @Test
    fun ownedEventsRow() {
        assertEquals(10, PlanTable.FREE.limit(Feature.Events))
        assertEquals(500, PlanTable.PREMIUM.limit(Feature.Events))
        assertEquals(500, PlanTable.PREMIUM_PLUS.limit(Feature.Events))
    }

    @Test
    fun photosRow() {
        assertEquals(5, PlanTable.FREE.limit(Feature.Photos))
        assertEquals(300, PlanTable.PREMIUM.limit(Feature.Photos))
    }

    @Test
    fun animatedPhotosRow() {
        assertEquals(0, PlanTable.FREE.limit(Feature.AnimatedBackdrop))
        assertFalse(PlanTable.FREE.includes(Feature.AnimatedBackdrop))
        assertEquals(30, PlanTable.PREMIUM.limit(Feature.AnimatedBackdrop))
    }

    @Test
    fun builtInTracksRow() {
        assertFalse(PlanTable.FREE.includes(Feature.PremiumAudio))
        assertTrue(PlanTable.PREMIUM.includes(Feature.PremiumAudio))
        assertEquals(null, PlanTable.PREMIUM.limit(Feature.PremiumAudio))
    }

    @Test
    fun customAudioRow() {
        assertEquals(0, PlanTable.FREE.limit(Feature.CustomAudio))
        assertEquals(20, PlanTable.PREMIUM.limit(Feature.CustomAudio))
    }

    @Test
    fun spotifyRow() {
        assertEquals(3, PlanTable.FREE.limit(Feature.SpotifyEvents))
        assertEquals(null, PlanTable.PREMIUM.limit(Feature.SpotifyEvents))
    }

    @Test
    fun premiumPlusIncludesEverythingInPremium() {
        for (feature in Feature.entries) {
            val premium = PlanTable.PREMIUM.limit(feature)
            val plus = PlanTable.PREMIUM_PLUS.limit(feature)
            assertTrue(plus == null || (premium != null && plus >= premium), feature.key)
        }
    }

    @Test
    fun keysAndPlanNamesUseTheirApiValues() {
        assertEquals(
            listOf("events", "photos", "animated_backdrop", "premium_audio", "custom_audio", "spotify_events"),
            Feature.entries.map { it.key },
        )
        for (feature in Feature.entries) assertEquals("\"${feature.key}\"", ModelJson.encodeToString(Feature.serializer(), feature))
        assertEquals(listOf("\"free\"", "\"premium\"", "\"premium_plus\""), Plan.entries.map { ModelJson.encodeToString(Plan.serializer(), it) })
    }

    @Test
    fun planOrder() {
        assertEquals(Plan.PremiumPlus, Plan.highest(listOf(Plan.Free, Plan.PremiumPlus, Plan.Premium)))
        assertEquals(Plan.Free, Plan.highest(emptyList()))
        assertTrue(Plan.Premium.atLeast(Plan.Free))
        assertFalse(Plan.Free.atLeast(Plan.Premium))
    }
}

class PlanGateTest {
    private val now = Instant.parse("2026-10-12T00:00:00Z")
    private val premiumTracks = setOf("orchestral-dawn")
    private val isPremium: (String) -> Boolean = { it in premiumTracks }

    private fun gate(plan: Plan, usage: UsageCounts, vararg needs: PlanNeed) = PlanGate.check(plan, usage, needs.toList())

    @Test
    fun eleventhEventOnFreeShowsThePaywall() {
        val r = gate(Plan.Free, UsageCounts(ownedEvents = 10), *PlanGate.needsForNewEvent().toTypedArray())
        assertEquals(GateResult.PremiumRequired(Feature.Events), r)
        assertEquals(ApiErrorCode.PremiumRequired, r.errorCode)
        assertEquals(GateResult.Allowed, gate(Plan.Free, UsageCounts(ownedEvents = 9), PlanNeed.Adds(Feature.Events)))
    }

    @Test
    fun archivedDaysStillCount() {
        // 10 owned days, 3 archived: the count passed in is 10 and the eleventh needs Premium.
        assertEquals(GateResult.PremiumRequired(Feature.Events), gate(Plan.Free, UsageCounts(ownedEvents = 10), PlanNeed.Adds(Feature.Events)))
    }

    @Test
    fun premiumAtItsLimitGetsQuotaExceeded() {
        assertEquals(GateResult.QuotaExceeded(Feature.Events), gate(Plan.Premium, UsageCounts(ownedEvents = 500), PlanNeed.Adds(Feature.Events)))
        val audio = gate(Plan.Premium, UsageCounts(customAudio = 20), *PlanGate.needsForUpload(MediaKind.Audio).toTypedArray())
        assertEquals(GateResult.QuotaExceeded(Feature.CustomAudio), audio)
        assertEquals(ApiErrorCode.QuotaExceeded, audio.errorCode)
        assertEquals(GateResult.QuotaExceeded(Feature.AnimatedBackdrop), gate(Plan.Premium, UsageCounts(animatedPhotos = 30), PlanNeed.Adds(Feature.AnimatedBackdrop)))
        assertEquals(GateResult.QuotaExceeded(Feature.Photos), gate(Plan.PremiumPlus, UsageCounts(photos = 300), PlanNeed.Adds(Feature.Photos)))
    }

    @Test
    fun photoLimits() {
        assertEquals(GateResult.Allowed, gate(Plan.Free, UsageCounts(photos = 4), *PlanGate.needsForUpload(MediaKind.Still).toTypedArray()))
        assertEquals(GateResult.PremiumRequired(Feature.Photos), gate(Plan.Free, UsageCounts(photos = 5), PlanNeed.Adds(Feature.Photos)))
        assertEquals(GateResult.Allowed, gate(Plan.Premium, UsageCounts(photos = 299), PlanNeed.Adds(Feature.Photos)))
    }

    @Test
    fun animatedPhotosNeedAPaidPlan() {
        assertEquals(GateResult.PremiumRequired(Feature.AnimatedBackdrop), gate(Plan.Free, UsageCounts(), *PlanGate.needsForUpload(MediaKind.Motion).toTypedArray()))
        assertEquals(GateResult.Allowed, gate(Plan.Premium, UsageCounts(animatedPhotos = 29), PlanNeed.Adds(Feature.AnimatedBackdrop)))
    }

    @Test
    fun savingAnAnimatedBackdropNeedsThePlanStillPhotoDoesNot() {
        val still = Backdrop(BackdropKind.Still, "Pz8aaaaaaaaaaaaaaaaaaa", dim = 0.0)
        val animated = Backdrop(BackdropKind.Animated, "Pz8aaaaaaaaaaaaaaaaaaa", "Hq3aaaaaaaaaaaaaaaaaaa", dim = 0.0)
        val needs = PlanGate.needsForBackdrop(null, animated)
        assertEquals(GateResult.PremiumRequired(Feature.AnimatedBackdrop), PlanGate.check(Plan.Free, UsageCounts(), needs))
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Free, UsageCounts(), PlanGate.needsForBackdrop(animated, still)))
        assertEquals(emptyList(), PlanGate.needsForBackdrop(animated, animated.copy(dim = 0.5)))
        assertEquals(emptyList(), PlanGate.needsForBackdrop(animated, null))
    }

    @Test
    fun premiumTracksNeedTheWritersPlan() {
        // A free editor saving a Premium track on a Premium owner's event: the writer's plan decides.
        val needs = PlanGate.needsForAudio(null, Audio.Library("orchestral-dawn"), writerSetBefore = false, isPremium)
        val r = PlanGate.check(Plan.Free, UsageCounts(), needs)
        assertEquals(GateResult.PremiumRequired(Feature.PremiumAudio), r)
        assertEquals("premium_audio", (r as GateResult.PremiumRequired).feature.key)
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Premium, UsageCounts(), needs))
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Free, UsageCounts(), PlanGate.needsForAudio(null, Audio.Library("calm-lofi"), false, isPremium)))
    }

    @Test
    fun customAudioOnADayNeedsThePlanEvenForALibraryFile() {
        val needs = PlanGate.needsForAudio(Audio.Library("calm-lofi"), Audio.Custom("Qm7aaaaaaaaaaaaaaaaaaa", "Song"), false, isPremium)
        assertEquals(GateResult.PremiumRequired(Feature.CustomAudio), PlanGate.check(Plan.Free, UsageCounts(customAudio = 3), needs))
        // At the Premium limit, using a file already in the library adds nothing.
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Premium, UsageCounts(customAudio = 20), needs))
        assertEquals(GateResult.PremiumRequired(Feature.CustomAudio), gate(Plan.Free, UsageCounts(), *PlanGate.needsForUpload(MediaKind.Audio).toTypedArray()))
    }

    @Test
    fun spotifyLimitCountsEventsTheWriterSet() {
        val link = Audio.Spotify("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")
        val other = Audio.Spotify("https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT")
        val fourth = PlanGate.needsForAudio(null, link, false, isPremium)
        assertEquals(GateResult.PremiumRequired(Feature.SpotifyEvents), PlanGate.check(Plan.Free, UsageCounts(spotifyEvents = 3), fourth))
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Free, UsageCounts(spotifyEvents = 2), fourth))
        assertEquals(GateResult.Allowed, PlanGate.check(Plan.Premium, UsageCounts(spotifyEvents = 900), fourth))
        // Changing a link the writer set keeps the count; taking over someone else's link adds one.
        assertEquals(emptyList(), PlanGate.needsForAudio(link, other, writerSetBefore = true, isPremium))
        assertEquals(listOf(PlanNeed.Adds(Feature.SpotifyEvents)), PlanGate.needsForAudio(link, other, writerSetBefore = false, isPremium))
    }

    @Test
    fun unchangedOrRemovedAudioNeedsNothing() {
        val premium = Audio.Library("orchestral-dawn")
        assertEquals(emptyList(), PlanGate.needsForAudio(premium, premium, false, isPremium))
        assertEquals(emptyList(), PlanGate.needsForAudio(premium, null, false, isPremium))
    }

    @Test
    fun lapsedPlanKeepsContentAboveTheFreeLimits() {
        // 20 photos, 8 animated photos and 5 Spotify events after Premium lapsed (premium spec "Subscription lapses").
        val usage = UsageCounts(ownedEvents = 14, photos = 20, animatedPhotos = 8, spotifyEvents = 5)
        val plan = Plans.effectivePlan(Plan.Premium, expiresAt = now - 1.days, now = now)
        assertEquals(Plan.Free, plan)
        // Nothing is added: edits that keep the counts are allowed.
        assertEquals(GateResult.Allowed, PlanGate.check(plan, usage, emptyList()))
        assertEquals(GateResult.Allowed, PlanGate.check(plan, usage, listOf(PlanNeed.Adds(Feature.Photos, 0))))
        // Adding more of anything shows the paywall.
        assertEquals(GateResult.PremiumRequired(Feature.Photos), PlanGate.check(plan, usage, listOf(PlanNeed.Adds(Feature.Photos))))
        assertEquals(GateResult.PremiumRequired(Feature.AnimatedBackdrop), PlanGate.check(plan, usage, listOf(PlanNeed.Adds(Feature.AnimatedBackdrop))))
        assertEquals(GateResult.PremiumRequired(Feature.SpotifyEvents), PlanGate.check(plan, usage, listOf(PlanNeed.Adds(Feature.SpotifyEvents))))
        assertEquals(GateResult.PremiumRequired(Feature.Events), PlanGate.check(plan, usage, listOf(PlanNeed.Adds(Feature.Events))))
    }

    @Test
    fun planBeforeExpiryIsKept() {
        assertEquals(Plan.Premium, Plans.effectivePlan(Plan.Premium, now + 1.days, now))
        assertEquals(Plan.Premium, Plans.effectivePlan(Plan.Premium, null, now))
        assertEquals(Plan.Free, Plans.effectivePlan(Plan.Premium, now, now))
    }

    @Test
    fun promotionEndsLikeALapsedPlan() {
        val grant = PlanPeriod(Plan.Premium, startsAt = now - 30.days, endsAt = now)
        assertEquals(Plan.Premium, Plans.effectivePlan(listOf(grant), now - 1.days))
        assertEquals(Plan.Free, Plans.effectivePlan(listOf(grant), now))
        // 15 events and 3 animated photos added during the grant stay; adding more needs a plan.
        val usage = UsageCounts(ownedEvents = 15, photos = 3, animatedPhotos = 3)
        assertEquals(GateResult.PremiumRequired(Feature.Events), PlanGate.check(Plan.Free, usage, PlanGate.needsForNewEvent()))
        assertEquals(GateResult.PremiumRequired(Feature.AnimatedBackdrop), PlanGate.check(Plan.Free, usage, PlanGate.needsForUpload(MediaKind.Motion)))
    }

    @Test
    fun grantAndSubscriptionTogether() {
        val grant = PlanPeriod(Plan.Premium, startsAt = now - 10.days, endsAt = now + 20.days)
        val subscription = PlanPeriod(Plan.Premium, endsAt = now + 365.days)
        assertEquals(Plan.Premium, Plans.effectivePlan(listOf(grant, subscription), now))
        assertEquals(Plan.Premium, Plans.effectivePlan(listOf(grant, subscription), now + 30.days))
        assertEquals(Plan.Free, Plans.effectivePlan(listOf(grant, subscription), now + 400.days))
        val future = PlanPeriod(Plan.PremiumPlus, startsAt = now + 1.days)
        assertEquals(Plan.Premium, Plans.effectivePlan(listOf(grant, future), now))
        assertEquals(Plan.PremiumPlus, Plans.effectivePlan(listOf(grant, future), now + 2.days))
    }

    @Test
    fun firstCheckThatFailsIsReported() {
        val r = PlanGate.check(Plan.Free, UsageCounts(ownedEvents = 10), listOf(PlanNeed.Includes(Feature.PremiumAudio), PlanNeed.Adds(Feature.Events)))
        assertEquals(GateResult.PremiumRequired(Feature.PremiumAudio), r)
        assertEquals(null, GateResult.Allowed.errorCode)
    }

    @Test
    fun addingSeveralAtOnceChecksTheTotal() {
        assertEquals(GateResult.PremiumRequired(Feature.Photos), gate(Plan.Free, UsageCounts(photos = 3), PlanNeed.Adds(Feature.Photos, 3)))
        assertEquals(GateResult.Allowed, gate(Plan.Free, UsageCounts(photos = 3), PlanNeed.Adds(Feature.Photos, 2)))
    }

    @Test
    fun usageCountsMapToFeatures() {
        val usage = UsageCounts(1, 2, 3, 4, 5)
        assertEquals(listOf(1, 2, 3, 0, 4, 5), Feature.entries.map(usage::of))
    }
}
