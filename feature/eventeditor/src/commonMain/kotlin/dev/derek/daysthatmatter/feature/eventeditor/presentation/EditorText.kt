package dev.derek.daysthatmatter.feature.eventeditor.presentation

import dev.derek.daysthatmatter.core.designsystem.meetsAa
import dev.derek.daysthatmatter.core.designsystem.resolveCardTone
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.toneContrast
import dev.derek.daysthatmatter.core.model.event.EventDoc
import dev.derek.daysthatmatter.core.model.event.Recurrence
import dev.derek.daysthatmatter.core.model.plan.Feature
import dev.derek.daysthatmatter.core.model.plan.GateResult
import dev.derek.daysthatmatter.core.model.plan.Plan
import dev.derek.daysthatmatter.core.model.plan.PlanTable
import dev.derek.daysthatmatter.core.model.validation.Limits
import dev.derek.daysthatmatter.core.model.validation.TextRules
import dev.derek.daysthatmatter.feature.eventeditor.domain.EventDraft
import dev.derek.daysthatmatter.feature.eventeditor.domain.GateCheck
import dev.derek.daysthatmatter.feature.eventeditor.domain.RepeatKind
import dev.derek.daysthatmatter.feature.events.domain.StoredEvent
import dev.derek.daysthatmatter.feature.events.domain.countdownAt
import dev.derek.daysthatmatter.feature.events.presentation.common.CardLook
import dev.derek.daysthatmatter.feature.events.presentation.common.CountdownText
import kotlinx.datetime.TimeZone
import kotlin.math.roundToInt
import kotlin.time.Instant

/** Texts, choices and the live preview of the editor (design/v2 `editorView` and `EDITOR_TABS`). */
object EditorText {
    /** `EMOJIS` of design/v2/app.js. */
    val emojis: List<String> = listOf(
        "✨", "🎂", "💞", "🏔️", "✈️", "🧧", "🎓", "💼", "🚀", "🐶",
        "🌱", "🍃", "🏃", "🎄", "🏠", "👶", "💍", "📚", "💸", "🎉",
    )

    /** `REPEATS` of design/v2/app.js. */
    fun repeatLabel(kind: RepeatKind): String = when (kind) {
        RepeatKind.None -> "Never"
        RepeatKind.Yearly -> "Every year"
        RepeatKind.Monthly -> "Every month"
        RepeatKind.Weekly -> "Every week"
        RepeatKind.EveryNDays -> "Every N days"
    }

    /** `STYLES` of design/v2/app.js: API id, name and line of help. */
    val styles: List<Triple<String, String, String>> = listOf(
        Triple("glass", "Glass", "Frosted chips"),
        Triple("clean", "Clean", "Flat, no effects"),
        Triple("outline", "Outline", "Light card, colored edge"),
        Triple("poster", "Poster", "Oversized number"),
    )

    /** `FONTS` of design/v2/app.js: API id and name. */
    val typefaces: List<Pair<String, String>> = listOf(
        "sans" to "Modern",
        "serif" to "Serif",
        "rounded" to "Rounded",
        "mono" to "Mono",
        "condensed" to "Poster",
    )

    const val SIZE_NOTE = "Small fits more days on a screen. Large adds the live countdown and takes the full width in the grid."
    const val FIXED_NOTE = "Fixed: everyone counts to the same moment. Good for flights and launches."
    const val FLOATING_NOTE = "Floating: everyone counts to their own local time. Good for birthdays and New Year."
    const val UNIT_NOTE = "Auto shows days, then hours and minutes in the last 48 hours. Workdays counts Monday to Friday " +
        "and skips weekends; public holidays are not skipped yet. Everyone with access sees this unit."
    const val NOTES_PLACEHOLDER = "Anything to remember. Never shared."
    const val TITLE_PLACEHOLDER = "What are you counting?"

    /** Shown in the preview while the title is empty. */
    const val UNTITLED = "New day"

    /** "12/100": the title length against `Limits.TITLE_MAX_CHARS`, counted in code points like `EventValidation`. */
    fun titleCounter(title: String): String =
        "${TextRules.codePointCount(title.trim())}/${Limits.TITLE_MAX_CHARS}"

    /** "only you · 12/4,000". */
    fun notesCounter(notes: String): String =
        "only you · ${TextRules.codePointCount(notes)}/${CountdownText.group(Limits.NOTES_MAX_CHARS.toLong())}"

    /**
     * The zone chips (v2): the device zone, the day's own fixed zone when it differs, and Floating. More zones come
     * from the zone list.
     */
    fun zoneChoices(current: String?, deviceZone: String): List<ZoneChoice> = buildList {
        add(ZoneChoice(deviceZone, "${CountdownText.city(deviceZone)} (this device)"))
        if (current != null && current != deviceZone) add(ZoneChoice(current, CountdownText.city(current)))
        add(ZoneChoice(null, "Floating"))
    }

    /** Every zone id the time zone database knows, sorted, for the zone list. */
    fun allZones(): List<String> = TimeZone.availableZoneIds.filter { '/' in it && !it.startsWith("Etc/") }.sorted()

    /** The zones whose id or city contains [query] (case-insensitive); all for a blank query. */
    fun filterZones(zones: List<String>, query: String): List<String> {
        val q = query.trim()
        if (q.isEmpty()) return zones
        return zones.filter { it.contains(q, ignoreCase = true) || CountdownText.city(it).contains(q, ignoreCase = true) }
    }

    /** Whether [paletteId] is one of the solid swatches (Background > Color) rather than a gradient preset. */
    fun isSwatch(paletteId: String): Boolean = CardPalette.swatches.any { CardLook.paletteId(it.name) == paletteId }

    /**
     * The live preview: the Home row of the draft in its size, with its countdown at [now] in [zone], and the
     * contrast line of v2 (`contrastInfo`): "8.2 : 1 contrast · passes AA".
     */
    fun preview(draft: EventDraft, original: EventDoc?, now: Instant, zone: TimeZone): PreviewState {
        val doc = previewDoc(draft, original, now)
        val card = CardLook.card(StoredEvent(doc, now).countdownAt(now, zone))
        val base = card.background.baseColor
        val tone = resolveCardTone(base)
        val ratio = toneContrast(base, 0f, tone)
        val ok = meetsAa(base, 0f, tone)
        val verdict = when {
            ok -> "passes AA"
            ratio >= 3f -> "large text only"
            else -> "too low"
        }
        return PreviewState(card, "${oneDecimal(ratio)} : 1 contrast · $verdict", ok)
    }

    /** The draft as a document the countdown engine accepts: an out-of-range "Every N days" previews as one-time. */
    private fun previewDoc(draft: EventDraft, original: EventDoc?, now: Instant): EventDoc {
        val doc = draft.toEventDoc(id = original?.id ?: "preview", base = original, now = now)
        val days = (doc.recurrence as? Recurrence.CustomDays)?.days ?: return doc.copy(title = doc.title.ifBlank { UNTITLED })
        val recurrence = if (days in 1..Limits.CUSTOM_DAYS_MAX) doc.recurrence else Recurrence.None
        return doc.copy(title = doc.title.ifBlank { UNTITLED }, recurrence = recurrence)
    }

    private fun oneDecimal(value: Float): String {
        val tenths = (value * 10).roundToInt()
        return "${tenths / 10}.${tenths % 10}"
    }

    /**
     * The owned-event limit in v2's words (`WALLS.events`, `gate()`): on Free the Premium offer, on a plan no higher
     * plan raises, "Limit reached". Numbers come from `PlanTable`.
     */
    fun gateNotice(check: GateCheck): GateNotice? {
        val limit = PlanTable.limits(check.plan).limit(Feature.Events)
        val premium = PlanTable.limits(Plan.Premium).limit(Feature.Events)
        return when (check.result) {
            GateResult.Allowed -> null
            is GateResult.PremiumRequired -> GateNotice(
                title = "${planName(check.plan)} includes $limit days",
                text = "Premium keeps up to $premium. Nothing you have is ever deleted. Plans and purchases come in a later update.",
            )
            is GateResult.QuotaExceeded -> GateNotice(
                title = "Limit reached",
                text = "${planName(check.plan)} includes up to $limit days. Remove one to add another.",
            )
        }
    }

    private fun planName(plan: Plan): String = when (plan) {
        Plan.Free -> "Free"
        Plan.Premium -> "Premium"
        Plan.PremiumPlus -> "Premium Plus"
    }
}
