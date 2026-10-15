package dev.derek.daysthatmatter.feature.events.ui

import dev.derek.daysthatmatter.core.designsystem.components.CardBackground
import dev.derek.daysthatmatter.core.designsystem.components.CardSize
import dev.derek.daysthatmatter.core.designsystem.components.DayCardState
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette

fun card(title: String, size: CardSize = CardSize.Medium, number: String = "38", unit: String = "days left") = DayCardState(
    title = title,
    emoji = "🎉",
    number = number,
    unit = unit,
    meta = "Sat, Nov 21",
    tick = if (size == CardSize.Large) "37d 04h 12m 08s" else null,
    background = CardBackground.Solid(CardPalette.Mint.color),
    size = size,
)
