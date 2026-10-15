package dev.derek.daysthatmatter.feature.events.domain

/** Filter chips of Home (design/v2: All, Upcoming, Since, then the categories). */
sealed interface HomeFilter {
    data object All : HomeFilter
    data object Upcoming : HomeFilter
    data object Since : HomeFilter
    data class Category(val id: String) : HomeFilter
}

/** Sort choices of Home (`SORTS` in design/v2/app.js). Pinned days stay first under every sort. */
enum class HomeSort { Closest, Furthest, AToZ, RecentlyAdded }

/** What Home shows: search text, filter and sort. */
data class HomeQuery(
    val text: String = "",
    val filter: HomeFilter = HomeFilter.All,
    val sort: HomeSort = HomeSort.Closest,
)

/**
 * Home's days in sections: [pinned] (newest pin first), then [upcoming] (today and later) and [since]
 * (count-ups), each sorted by the query's sort.
 */
data class HomeDays(
    val pinned: List<EventCountdown>,
    val upcoming: List<EventCountdown>,
    val since: List<EventCountdown>,
) {
    val isEmpty: Boolean get() = pinned.isEmpty() && upcoming.isEmpty() && since.isEmpty()
}

/** A category of the owner's days (`categoryId`). The ids are the API values. */
data class Category(val id: String, val name: String, val emoji: String)

/** The built-in categories (`CATS` in design/v2/app.js). Custom categories come later. */
object Categories {
    val Birthdays = Category("birthdays", "Birthdays", "🎂")
    val Anniversaries = Category("anniversaries", "Anniversaries", "💞")
    val Travel = Category("travel", "Travel", "✈️")
    val Holidays = Category("holidays", "Holidays", "🧧")
    val Work = Category("work", "Work", "💼")
    val Life = Category("life", "Life", "🌱")

    val all: List<Category> = listOf(Birthdays, Anniversaries, Travel, Holidays, Work, Life)

    fun byId(id: String?): Category? = all.firstOrNull { it.id == id }
}
