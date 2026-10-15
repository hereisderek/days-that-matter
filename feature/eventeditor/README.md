# :feature:eventeditor

The event editor: create a day, or edit one the reader owns (docs/features/events/SPEC.md section 4.3, docs/features/customization/SPEC.md, design-v2 `home-screen` 2.1 and 2.2), built from `design/v2` (`editorView`, `EDITOR_TABS`, `openEditor`, `save`) with the components of `:core:designsystem`.

## Layers

- `domain/`: pure Kotlin.
  - `EventDraft`: the editor's working copy and its mapping to and from `EventDoc` (`of`, `toEventDoc`). Fields the editor does not show (backdrop, audio, reminders, archive state, server revision, role) are carried over from the stored document.
  - `EventWriteChecks`: validation and patches on `:core:model`. Errors come from `EventValidation.validateNew` / `validatePatch` and `checkDocumentSize`, so no limit is repeated here; `patch` is the writable fields that changed (the `PATCH /events/{id}` and `pending_patch` form); `apply` merges a patch with `PatchMerge.applyToEvent` (design D5). `DraftField` maps a validation path to the field that shows the error.
  - `LoadEditableEventUseCase` (owner only; editors and viewers get `NotAllowed`), `CheckNewEventGateUseCase` (`PlanGate` with `needsForNewEvent`; owned days, archived ones included), `UpsertEventUseCase` (create or edit, offline first), `PlanProvider` (Free until accounts and purchases exist), `EventIdGenerator` (UUID).
- `presentation/`: `EventEditorViewModel` (`StateFlow<EditorUiState>`, `onIntent(EditorIntent)`, one-shot `EditorEffect`), `EventEditorRoute`/`EventEditorScreen`, `EditorText` (choices, notes, counters, the gate notice and the live preview).
- `di/eventEditorModule`: Koin. Needs `eventsModule` (repository, device zone) and a `kotlin.time.Clock`.

## Saving

- Create: the gate first (Free: 10 owned days), then a new UUID, role owner, no server revision, created and updated time from the clock, validated as a new document, `EventRepository.add`.
- Edit: the patch from the loaded document to the draft is validated as a patch and applied field by field to the stored document inside `EventRepository.edit`, so a change stored meanwhile (an archive from Home, later the sync engine) is kept. `RoomEventRepository` sets `updated_at` and, for a row with a `server_rev`, adds the changed fields to `pending_patch` (`withLocalEdit` in `:core:database`); a never-synced row keeps no patch. `RoomUpsertTest` checks both on Room.
- `:core:model` has no document diff; `EventWriteChecks.patch` builds it the same way as `EventPatches.diff` in `:core:database` (full JSON with defaults and nulls, writable fields only), so the editor does not depend on the database module.

## Entry points

- Home: the floating "New day" button (`HomeRoute(onNewDay = ...)`, v2 `.fab`).
- Day page: an Edit button at the top right for the owner (`DayRoute(onEdit = ...)`).
- `:composeApp`: `EditorKey(id: String?)` (null = new day). After saving a new day the editor is replaced by its day page (v2 `save`); after an edit it returns to where it came from. System back with unsaved changes asks first (`NavigationBackHandler`).

## Tests

| Where | What | Command |
| :--- | :--- | :--- |
| `commonTest` | draft mapping round trips, validation and patches, use cases with a fake repository, the ViewModel (Turbine, `StandardTestDispatcher`), texts and preview | jvm target and Android host tests |
| `jvmTest` | `RoomUpsertTest` (in-memory Room: pending patch, created row), Compose UI tests of the editor (headless) | `./gradlew :feature:eventeditor:jvmTest` |

`./gradlew :feature:eventeditor:allTests` runs both (jvm and `testAndroidHostTest`).

## Parity with design/v2

| Element | v2 source | Here | Matches | Why not, or what differs |
| :--- | :--- | :--- | :--- | :--- |
| Bar: Cancel, title, Save | `.ed-bar`, `.txt-btn`, `.save-btn` | `EditorTopBar` | yes | 48 dp touch targets (allowed). Save is disabled until the draft is valid; v2 keeps it on and toasts "Give it a name first" (the brief asks for disabled). Title "Edit day"; v2 says "Customize" for the owner. |
| Live preview | `.ed-preview` with the card | `PreviewStage` + `DayCardRow` in the chosen size | partly | Height 196 dp (v2's short-screen value) instead of 248. Only the list row: v2's Pinned and Widget switch is left out, those cards are not built. |
| Tabs | `.tabs`: Details, Background, Style, Sound | `DtmTabRow`: Details, Background, Style | partly | Sound comes with the audio work. |
| Title with counter | `.input.title`, `#title-count` | `DtmTextField(large)` + `FieldLabel` "n/100" | yes | No `maxlength`: longer text shows the `EventValidation` error inline. |
| Emoji | `.emojis` (20 emojis) | `EmojiPicker` | yes | |
| Date, Time (optional) | `input type=date/time` | `DtmDateField`, `DtmTimeField` (Material 3 dialogs) | yes | Material pickers per events SPEC 4.3; the time has a clear button. Years 1900 to 2200 (`Limits`). |
| Time zone | chips: device, own zone, Floating, and the note | chips + "Other…" with a searchable zone list | yes | The zone list is extra (the brief asks for a fixed zone from a list). |
| Repeat | chips + "Every N days" input | chips + numeric field | yes | Range 1 to 3,650 from `Limits` (v2's input says 2 to 365). |
| Category | chips, "only you" | `CategoryChip` row | yes | Tapping the selected chip clears it (the model allows none). |
| Pin to top | `.switch-row` | `ToggleRow` | yes | Hidden for archived days (they cannot be pinned). Text names the Pinned section; the carousel is not built. |
| Notes | `.input.area`, "only you · n/4,000" | `DtmTextField(minLines = 3)` | yes | |
| Remind me | chips | not built | no | Reminders are not in this wave. |
| Background: Color, Gradient | `.seg`, `.swatches` (16), `.tiles` (8) | `DtmSegmentedControl`, `ColorSwatchPicker`, `GradientTilePicker` | partly | Photo and Art tabs, the custom color, Darken and Blur come with the backdrop work. |
| Contrast line | `.contrast` | `ContrastNote` | yes | Same wording and AA test (`resolveCardTone`, `meetsAa`). |
| Card style | `.style-opts` with mini cards | `SelectableTile` with a Small `DayCardRow` | partly | v2's `mini` card context is not built; the Small row stands in. |
| Size in the list | `.seg` Small / Medium / Large + note | `DtmSegmentedControl` + `FieldNote` | yes | Sets `theme.size`. |
| Typeface | `.font-opts` (5) | `SelectableTile` x 5 | yes | Serif, Rounded and Condensed use the design system's fallbacks (its README). |
| Text color | `.seg` Auto / Light / Dark | not built | no | `theme` has no text color field; cards always use auto contrast. |
| Count in | chips of the six units + note | chips + `FieldNote` | yes | |
| Discard on Cancel | none (v2 discards at once) | confirmation dialog | deviation | Asked for by the brief. |
| Owned-event limit | paywall sheet on "New" and on Save | dialog with v2's texts, on open and on Save | partly | No purchase yet; the dialog closes the editor. |
| Edge to edge | `--top` padding | `safeDrawing` insets; the form scrolls above the navigation bar and keyboard | improvement | |
