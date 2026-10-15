package dev.derek.daysthatmatter.feature.eventeditor.presentation

import dev.derek.daysthatmatter.core.designsystem.components.CardStyle
import dev.derek.daysthatmatter.core.designsystem.components.CardTypeface
import dev.derek.daysthatmatter.core.model.event.CardSize
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.plan.Feature
import dev.derek.daysthatmatter.core.model.plan.GateResult
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.feature.eventeditor.NOW
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.GateCheck
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EditorTextTest {

    @Test
    fun countersUseTheModelLimits() {
        assertEquals("11/100", EditorText.titleCounter(" Norway trip "))
        assertEquals("2/100", EditorText.titleCounter("🏔️"))
        assertEquals("only you · 4/4,000", EditorText.notesCounter("boot"))
    }

    @Test
    fun zoneChipsOfferTheDeviceTheDaysOwnZoneAndFloating() {
        assertEquals(
            listOf(ZoneChoice("America/New_York", "New York (this device)"), ZoneChoice(null, "Floating")),
            EditorText.zoneChoices(null, "America/New_York"),
        )
        assertEquals(
            listOf(ZoneChoice("UTC", "UTC (this device)"), ZoneChoice("Asia/Tokyo", "Tokyo"), ZoneChoice(null, "Floating")),
            EditorText.zoneChoices("Asia/Tokyo", "UTC"),
        )
    }

    @Test
    fun theZoneListIsSearchable() {
        val zones = EditorText.allZones()
        assertTrue("Europe/Oslo" in zones)
        assertTrue(zones.none { it.startsWith("Etc/") })
        assertEquals(zones.sorted(), zones)
        assertEquals(listOf("America/New_York"), EditorText.filterZones(listOf("America/New_York", "Europe/Oslo"), "new york"))
        assertEquals(listOf("Europe/Oslo"), EditorText.filterZones(listOf("America/New_York", "Europe/Oslo"), "EUROPE"))
        assertEquals(2, EditorText.filterZones(listOf("America/New_York", "Europe/Oslo"), " ").size)
    }

    @Test
    fun gateNoticesFollowV2() {
        val free = EditorText.gateNotice(GateCheck(Plan.Free, GateResult.PremiumRequired(Feature.Events)))!!
        assertEquals("Free includes 10 days", free.title)
        assertTrue(free.text.startsWith("Premium keeps up to 500."))
        val premium = EditorText.gateNotice(GateCheck(Plan.Premium, GateResult.QuotaExceeded(Feature.Events)))!!
        assertEquals("Limit reached", premium.title)
        assertEquals("Premium includes up to 500 days. Remove one to add another.", premium.text)
        assertNull(EditorText.gateNotice(GateCheck(Plan.Free, GateResult.Allowed)))
    }

    @Test
    fun thePreviewDrawsTheDraftInItsSizeWithTheContrastLine() {
        val draft = EventDraft.new(LocalDate(2026, 11, 13), "UTC").copy(
            title = "Trip",
            paletteId = "mint",
            cardStyle = "outline",
            typography = "serif",
            size = CardSize.Large,
        )

        val preview = EditorText.preview(draft, original = null, now = NOW, zone = TimeZone.UTC)

        assertEquals("Trip", preview.card.title)
        // 29 whole days and 15 hours from 14 Oct 09:00 UTC to 13 Nov 00:00 UTC.
        assertEquals("29", preview.card.number)
        assertEquals(CardStyle.Outline, preview.card.style)
        assertEquals(CardTypeface.Serif, preview.card.typeface)
        assertEquals(dev.derek.daysthatmatter.core.designsystem.components.CardSize.Large, preview.card.size)
        assertTrue(preview.card.tick != null, "Large rows show the ticker")
        assertTrue(preview.contrastOk)
        assertTrue(preview.contrastText.endsWith(": 1 contrast · passes AA"), preview.contrastText)
    }

    @Test
    fun aBrokenEveryNDaysStillPreviews() {
        val draft = EventDraft.new(LocalDate(2026, 11, 13), "UTC").copy(repeat = RepeatKind.EveryNDays, everyDays = "abc")
        val preview = EditorText.preview(draft, null, NOW, TimeZone.UTC)
        assertEquals(EditorText.UNTITLED, preview.card.title)
        assertEquals(Recurrence.CustomDays(0), draft.recurrence)
    }

    @Test
    fun swatchesAndGradientsAreTold() {
        assertTrue(EditorText.isSwatch("mint"))
        assertTrue(EditorText.isSwatch("ink"))
        assertFalse(EditorText.isSwatch("lagoon"))
        assertFalse(EditorText.isSwatch("deep-sea"))
    }

    @Test
    fun choiceListsMatchV2() {
        assertEquals(20, EditorText.emojis.size)
        assertEquals(listOf("glass", "clean", "outline", "poster"), EditorText.styles.map { it.first })
        assertEquals(listOf("sans", "serif", "rounded", "mono", "condensed"), EditorText.typefaces.map { it.first })
        assertEquals("Every N days", EditorText.repeatLabel(RepeatKind.EveryNDays))
        assertEquals("Never", EditorText.repeatLabel(RepeatKind.None))
    }
}
