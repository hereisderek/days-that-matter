package dev.derek.daysthatmatter.core.model.validation

/**
 * Character rules for user text, ported from `services/share/src/lib/validate.ts`.
 *
 * Lengths count Unicode code points, not UTF-16 units, as the old service did.
 *
 * Known gap: the old service NFC-normalized titles before counting. Common Kotlin has no Unicode
 * normalization and the domain may not use platform APIs (docs/standards/CODING_STANDARDS.md 2.1),
 * so `:core:model` trims but does not normalize. The app's platform layer or the backend core adds
 * NFC normalization before calling these rules.
 */
object TextRules {
    /**
     * True for characters no text field may contain: C0 and C1 controls, DEL, line and paragraph
     * separators, bidi embeddings and overrides (U+202A to U+202E) and bidi isolates (U+2066 to U+2069).
     * Multi-line fields allow line feed and tab; see [hasForbiddenChars].
     */
    fun isForbidden(codePoint: Int, multiLine: Boolean = false): Boolean {
        if (multiLine && (codePoint == '\n'.code || codePoint == '\t'.code)) return false
        return codePoint in 0x00..0x1F ||
            codePoint in 0x7F..0x9F ||
            codePoint == 0x2028 ||
            codePoint == 0x2029 ||
            codePoint in 0x202A..0x202E ||
            codePoint in 0x2066..0x2069
    }

    fun hasForbiddenChars(text: String, multiLine: Boolean = false): Boolean =
        codePoints(text).any { isForbidden(it, multiLine) }

    /** True when [text] has an unpaired UTF-16 surrogate, which is not valid Unicode. */
    fun hasLoneSurrogate(text: String): Boolean {
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c.isHighSurrogate()) {
                if (i + 1 >= text.length || !text[i + 1].isLowSurrogate()) return true
                i += 2
            } else {
                if (c.isLowSurrogate()) return true
                i++
            }
        }
        return false
    }

    /** Code points of [text]; a lone surrogate is returned as itself. */
    fun codePoints(text: String): List<Int> {
        val out = ArrayList<Int>(text.length)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c.isHighSurrogate() && i + 1 < text.length && text[i + 1].isLowSurrogate()) {
                out += 0x10000 + ((c.code - 0xD800) shl 10) + (text[i + 1].code - 0xDC00)
                i += 2
            } else {
                out += c.code
                i++
            }
        }
        return out
    }

    fun codePointCount(text: String): Int = codePoints(text).size

    /** Length of [text] in UTF-8 bytes. */
    fun utf8Length(text: String): Int = text.encodeToByteArray().size

    /**
     * Number of user-perceived characters, for the emoji rule.
     *
     * A simplified form of the extended grapheme cluster rules of Unicode UAX #29 that covers emoji:
     * combining marks, variation selectors, emoji modifiers, tag characters and the enclosing keycap
     * join the previous character; a zero width joiner joins the characters on both sides; regional
     * indicators pair into flags. Scripts that need the full rules (Hangul jamo, Indic spacing marks)
     * may count higher than a full implementation, which only makes the emoji rule stricter.
     */
    fun graphemeCount(text: String): Int {
        var count = 0
        var previous = -1
        var regionalRun = 0
        for (cp in codePoints(text)) {
            val joins = previous != -1 &&
                (isExtend(cp) || cp == ZWJ || (previous == ZWJ && isPictographic(cp)))
            val pairsFlag = isRegionalIndicator(cp) && regionalRun % 2 == 1
            if (!joins && !pairsFlag) count++
            regionalRun = if (isRegionalIndicator(cp)) regionalRun + 1 else 0
            previous = cp
        }
        return count
    }

    private const val ZWJ = 0x200D

    private fun isRegionalIndicator(cp: Int): Boolean = cp in 0x1F1E6..0x1F1FF

    /** Approximates `Extended_Pictographic`: the symbol and emoji blocks a ZWJ sequence joins. */
    private fun isPictographic(cp: Int): Boolean =
        cp == 0x00A9 || cp == 0x00AE || cp == 0x203C || cp == 0x2049 || cp == 0x2122 || cp == 0x2139 ||
            cp in 0x2190..0x2BFF ||
            cp in 0x3030..0x303D ||
            cp in 0x1F000..0x1FFFD

    private fun isExtend(cp: Int): Boolean =
        cp in 0x0300..0x036F ||
            cp in 0x1AB0..0x1AFF ||
            cp in 0x1DC0..0x1DFF ||
            cp in 0x20D0..0x20FF ||
            cp in 0xFE00..0xFE0F ||
            cp in 0xFE20..0xFE2F ||
            cp == 0x200C ||
            cp in 0x1F3FB..0x1F3FF ||
            cp in 0xE0020..0xE007F ||
            cp in 0xE0100..0xE01EF
}
