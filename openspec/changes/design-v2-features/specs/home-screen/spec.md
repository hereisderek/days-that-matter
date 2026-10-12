# Delta for Home Screen

## Purpose

Shows the user's days on Home: card sizes, the memo badge, archiving, and the pinned carousel with a list that follows it.

## ADDED Requirements

### Requirement: Card size
Each day SHALL have a card size, Small, Medium or Large, default Medium, stored as part of its shared look (`theme.size`). In the Home list, a Small row SHALL be 64 pt tall (emoji, title, number), a Medium row 84 pt (adds the date line and unit) and a Large row 132 pt (a 44 pt number, the date and repeat line, and a live ticker).

#### Scenario: Large card in the list
- **WHEN** the owner sets a day to Large
- **THEN** its row in the Home list is 132 pt tall and shows a live ticker

#### Scenario: Members see the size
- **WHEN** an editor sets a shared day to Small
- **THEN** the owner and the other members see a 64 pt row for that day

### Requirement: Where card size applies
In the Home grid, a Large card SHALL span two columns. The pinned carousel, the day page, widgets, share images and the web page SHALL ignore card size.

#### Scenario: Large card in the grid
- **WHEN** the Home list is in grid mode and a day is Large
- **THEN** its card spans both columns

#### Scenario: Widget ignores size
- **WHEN** a Small day is shown in a home screen widget
- **THEN** the widget draws it the same as a Medium day

### Requirement: Memo badge
On the owner's cards, a day with memos SHALL show a badge with the memo icon and the number of memos, "9+" above 9, on list rows, grid tiles and pinned cards. The badge SHALL NOT be shown to members, on web pages, on widgets or in share images.

#### Scenario: Twelve memos
- **WHEN** the owner's day has 12 memos
- **THEN** its card shows the memo icon and "9+"

#### Scenario: Member's card
- **WHEN** a member sees a shared day whose owner wrote memos
- **THEN** the member's card shows no memo badge

### Requirement: Memo badge position from remote config
The badge position SHALL come from `GET /config` field `ui.memoBadge`: `top-left` (hanging from the top edge, 24 pt from the left edge) or `top-right` (flush with the right edge, 10 pt from the top; on pinned cards below the emoji), default `top-right`. The operator SHALL be able to change it per deployment without an app release. The app SHALL cache the last config and use the default when it has none.

#### Scenario: Operator moves the badge
- **WHEN** the operator sets `ui.memoBadge` to `top-left`
- **THEN** after its next config fetch the app shows badges at the top left, with no app update

#### Scenario: First start offline
- **WHEN** the app starts for the first time without a network
- **THEN** badges show at the top right

### Requirement: Archive a day
Archiving SHALL hide a day from Home (list, grid, pinned carousel, filters and search) and from widget choices. Archiving a pinned day SHALL unpin it; unarchiving SHALL NOT pin it again. Reminders and change notifications SHALL be off for archived days. Archived owned days SHALL still count toward the owned-event limit.

#### Scenario: Archive a pinned day
- **WHEN** the owner archives a pinned day and later unarchives it
- **THEN** the day leaves the carousel and the list, and after unarchiving it is back in the list without a pin

#### Scenario: Archived days count
- **WHEN** a free user with 10 owned days, 3 of them archived, creates another day
- **THEN** the paywall appears

### Requirement: Archive is personal
An owner's archive SHALL be stored as the owner-only field `archivedAt` on the event, synced to the owner's devices and never shared. A member's archive SHALL be stored on their membership and SHALL affect only that member. Viewers and editors SHALL be able to archive days shared with them.

#### Scenario: Member archives a shared day
- **WHEN** a viewer archives a day shared with them
- **THEN** the day leaves the viewer's Home on all their devices, and the owner and other members still see it

#### Scenario: Owner archives a shared day
- **WHEN** the owner archives a day they share with two editors
- **THEN** the editors still see the day on their Home

### Requirement: Archived screen
A row at the bottom of the Home list SHALL show the number of archived days ("Archived · 3") and open the Archived screen. The row SHALL be hidden when no day is archived. On the Archived screen, days SHALL open normally and SHALL offer Unarchive and Delete, or Leave for days shared with the user.

#### Scenario: Open an archived day
- **WHEN** the user opens the Archived screen and taps a day
- **THEN** the day page opens as usual and offers Unarchive

### Requirement: Pinning days
The owner SHALL be able to pin any number of their own days. Pinned days SHALL appear in the carousel newest pin first (owner-only field `pinnedAt`) and SHALL stay in the list with a pin icon. Members SHALL NOT be able to pin days shared with them.

#### Scenario: Pin a third day
- **WHEN** the owner, with 2 days pinned, pins another day
- **THEN** that day is the first card of the carousel and keeps its place in the list with a pin icon

#### Scenario: Member's menu
- **WHEN** a member long-presses a day shared with them
- **THEN** the menu offers no pin option

### Requirement: Pinned carousel
The carousel SHALL sit at the top of Home when at least one owned day is pinned. The centred card SHALL be full size; its neighbours SHALL show a 16 pt edge, scaled to 92% toward the centre and faded to 60%. A swipe SHALL move one card. Dots SHALL show the count and position. Tapping an edge or a dot SHALL centre that card; tapping the centred card SHALL open the day.

#### Scenario: Tap a dot
- **WHEN** the user taps the third dot under the carousel
- **THEN** the third pinned card moves to the centre

#### Scenario: Open from the carousel
- **WHEN** the user taps the centred card
- **THEN** that day's page opens

### Requirement: Carousel visibility
The carousel SHALL be hidden while the user searches or filters, and a setting SHALL turn it off; pins then show only as icons in the list.

#### Scenario: Search hides the carousel
- **WHEN** the user types in the search field
- **THEN** the carousel is hidden until the search is cleared

### Requirement: The list follows the carousel
When the carousel settles on a card, the list SHALL scroll to that day's row and outline it. The outline SHALL stay while that card is centred. Under reduce motion the list SHALL jump to the row instead of scrolling.

#### Scenario: Swipe to the next pinned day
- **WHEN** the user swipes the carousel to the next card
- **THEN** the list scrolls to that day's row and outlines it

#### Scenario: Reduce motion
- **WHEN** reduce motion is on and the carousel settles on a card
- **THEN** the list jumps to the row without animation

### Requirement: Fixed header and collapsing carousel
The header and the carousel SHALL stay fixed at the top of Home and only the list SHALL scroll. When the user scrolls the list, the carousel SHALL collapse to a 96 pt strip with the title and number, and SHALL expand again when the list is back at the top. The scroll that follows the carousel SHALL NOT collapse it.

#### Scenario: User scrolls the list
- **WHEN** the user scrolls the list down
- **THEN** the carousel becomes a 96 pt strip and expands again when the list returns to the top

#### Scenario: Follow scroll
- **WHEN** the list scrolls because the carousel settled on a card
- **THEN** the carousel stays full size
