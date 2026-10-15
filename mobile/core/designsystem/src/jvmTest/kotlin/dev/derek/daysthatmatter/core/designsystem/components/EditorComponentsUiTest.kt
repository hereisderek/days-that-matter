@file:OptIn(ExperimentalTestApi::class)

package dev.derek.daysthatmatter.core.designsystem.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.v2.runComposeUiTest
import androidx.compose.ui.unit.dp
import dev.derek.daysthatmatter.core.designsystem.icons.EditorIcons
import dev.derek.daysthatmatter.core.designsystem.theme.CardPalette
import dev.derek.daysthatmatter.core.designsystem.theme.DaysThatMatterTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EditorComponentsUiTest {

    @Test
    fun textFieldTakesInputAndShowsItsError() = runComposeUiTest {
        var text by mutableStateOf("")
        var error by mutableStateOf<String?>(null)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                androidx.compose.foundation.layout.Column {
                    FieldLabel("Title", trailing = "${text.length}/100", trailingTestTag = DtmFormTestTags.Counter)
                    DtmTextField(
                        value = text,
                        onValueChange = { text = it },
                        placeholder = "What are you counting?",
                        error = error,
                        large = true,
                        contentDescription = "Title",
                        modifier = Modifier.testTag("field"),
                    )
                }
            }
        }
        onNodeWithText("What are you counting?").assertIsDisplayed()
        onNodeWithContentDescription("Title").performTextInput("Norway")
        assertEquals("Norway", text)
        onNodeWithTag(DtmFormTestTags.Counter).assertTextEquals("6/100")
        onNodeWithTag(DtmFormTestTags.FieldError).assertDoesNotExist()

        error = "Title must be 1 to 100 characters"
        onNodeWithTag(DtmFormTestTags.FieldError).assertTextEquals("Title must be 1 to 100 characters")
        onNodeWithContentDescription("Title").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
    }

    @Test
    fun notesShowTheirText() = runComposeUiTest {
        setContent {
            DaysThatMatterTheme(darkTheme = true) {
                androidx.compose.foundation.layout.Column {
                    FieldNote("Small fits more days on a screen.")
                    InfoNote("Only you see the notes.")
                    ContrastNote("Text is easy to read", ok = true)
                }
            }
        }
        onNodeWithText("Small fits more days on a screen.").assertIsDisplayed()
        onNodeWithText("Only you see the notes.").assertIsDisplayed()
        onNodeWithTag(DtmFormTestTags.ContrastNote).assertIsDisplayed()
    }

    @Test
    fun segmentedControlSelectsOneOption() = runComposeUiTest {
        var selected by mutableIntStateOf(1)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DtmSegmentedControl(listOf("Small", "Medium", "Large"), selected, onSelect = { selected = it })
            }
        }
        onNodeWithText("Medium").assertIsSelected()
        onNodeWithText("Large").assertIsNotSelected().performClick()
        assertEquals(2, selected)
        onNodeWithText("Large").assertIsSelected()
        onNodeWithText("Medium").assertIsNotSelected()
    }

    @Test
    fun toggleRowFlipsItsSwitch() = runComposeUiTest {
        var checked by mutableStateOf(false)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                ToggleRow("Pin to top", checked, onCheckedChange = { checked = it }, subtitle = "Shows first on Home", modifier = Modifier.testTag("row"))
            }
        }
        onNodeWithTag("row").assertIsOff().performClick()
        assertTrue(checked)
        onNodeWithTag("row").assertIsOn()
        onNodeWithText("Shows first on Home").assertIsDisplayed()
    }

    @Test
    fun emojiPickerSelectsAnEmoji() = runComposeUiTest {
        var selected by mutableStateOf<String?>("✨")
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                EmojiPicker(listOf("✨", "🎂", "💞"), selected, onSelect = { selected = it })
            }
        }
        onNodeWithTag(DtmPickerTestTags.option("✨")).assertIsSelected().assertHeightIsEqualTo(46.dp)
        onNodeWithContentDescription("Emoji 🎂").performClick()
        assertEquals("🎂", selected)
        onNodeWithTag(DtmPickerTestTags.option("🎂")).assertIsSelected()
    }

    @Test
    fun swatchPickerSelectsByName() = runComposeUiTest {
        var selected by mutableStateOf<String?>("Mint")
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                ColorSwatchPicker(CardPalette.swatches, selected, onSelect = { selected = it.name })
            }
        }
        onNodeWithTag(DtmPickerTestTags.option("Mint")).assertIsSelected()
        onNodeWithContentDescription("Ocean").assertIsNotSelected().performClick()
        assertEquals("Ocean", selected)
        onNodeWithTag(DtmPickerTestTags.option("Ocean")).assertIsSelected()
    }

    @Test
    fun gradientPickerShowsNamesAndSelects() = runComposeUiTest {
        var selected by mutableStateOf<String?>(null)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                GradientTilePicker(CardPalette.gradients, selected, onSelect = { selected = it })
            }
        }
        onNodeWithText("Deep sea").assertIsDisplayed()
        onNodeWithTag(DtmPickerTestTags.option("Dusk")).assertIsNotSelected().performClick()
        assertEquals("Dusk", selected)
        onNodeWithTag(DtmPickerTestTags.option("Dusk")).assertIsSelected()
    }

    @Test
    fun selectableTileReportsSelection() = runComposeUiTest {
        var selected by mutableStateOf(false)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                SelectableTile(selected, onClick = { selected = !selected }, label = "Serif") { Text("38") }
            }
        }
        onNodeWithContentDescription("Serif").assertIsNotSelected().performClick()
        onNodeWithContentDescription("Serif").assertIsSelected()
    }

    @Test
    fun editorTopBarDisablesSaveUntilValid() = runComposeUiTest {
        var saves = 0
        var cancels = 0
        var enabled by mutableStateOf(false)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                EditorTopBar("New day", onCancel = { cancels++ }, onSave = { saves++ }, saveEnabled = enabled)
            }
        }
        onNodeWithText("New day").assertIsDisplayed()
        onNodeWithTag(DtmEditorTestTags.Save).performClick()
        assertEquals(0, saves)
        enabled = true
        onNodeWithTag(DtmEditorTestTags.Save).performClick()
        assertEquals(1, saves)
        onNodeWithTag(DtmEditorTestTags.Cancel).performClick()
        assertEquals(1, cancels)
    }

    @Test
    fun tabRowSwitchesTabs() = runComposeUiTest {
        var selected by mutableIntStateOf(0)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DtmTabRow(listOf("Details", "Background", "Style"), selected, onSelect = { selected = it })
            }
        }
        onNodeWithTag(DtmEditorTestTags.tab("Details")).assertIsSelected().assertHeightIsEqualTo(44.dp)
        onNodeWithText("Style").performClick()
        assertEquals(2, selected)
        onNodeWithTag(DtmEditorTestTags.tab("Style")).assertIsSelected()
    }

    @Test
    fun previewStageHoldsItsContent() = runComposeUiTest {
        setContent {
            DaysThatMatterTheme(darkTheme = true) {
                PreviewStage { Icon(EditorIcons.Edit, contentDescription = "Edit", modifier = Modifier.size(20.dp)) }
            }
        }
        onNodeWithTag(DtmEditorTestTags.Preview).assertHeightIsEqualTo(196.dp)
        onNodeWithContentDescription("Edit").assertIsDisplayed()
        assertEquals(3, EditorIcons.All.size)
    }

    @Test
    fun dateFieldOpensThePickerAndReturnsTheDate() = runComposeUiTest {
        // 21 November 2026, 00:00 UTC.
        val nov21 = 1_795_219_200_000L
        var picked: Long? = null
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DtmDateField("Sat, 21 Nov 2026", selectedDateMillis = nov21, onDateSelected = { picked = it }, yearRange = 1900..2200)
            }
        }
        onNodeWithContentDescription("Date, Sat, 21 Nov 2026").assertIsDisplayed()
        onNodeWithTag(DtmDateTimeTestTags.DateField).performClick()
        onNodeWithTag(DtmDateTimeTestTags.Dismiss).performClick()
        assertNull(picked)
        onNodeWithTag(DtmDateTimeTestTags.DateField).performClick()
        onNodeWithTag(DtmDateTimeTestTags.Confirm).performClick()
        assertEquals(nov21, picked)
        onNodeWithTag(DtmDateTimeTestTags.Confirm).assertDoesNotExist()
    }

    @Test
    fun timeFieldPicksAndClearsTheTime() = runComposeUiTest {
        var time by mutableStateOf<Pair<Int, Int>?>(null)
        setContent {
            DaysThatMatterTheme(darkTheme = false) {
                DtmTimeField(
                    text = time?.let { (h, m) -> "$h:${m.toString().padStart(2, '0')}" },
                    hour = time?.first ?: 9,
                    minute = time?.second ?: 30,
                    onTimeSelected = { h, m -> time = h to m },
                    onClear = { time = null },
                )
            }
        }
        onNodeWithText("Add time").assertIsDisplayed()
        onNodeWithTag(DtmDateTimeTestTags.ClearTime).assertDoesNotExist()
        onNodeWithTag(DtmDateTimeTestTags.TimeField).performClick()
        onNodeWithTag(DtmDateTimeTestTags.Confirm).performClick()
        assertNotNull(time)
        assertEquals(9 to 30, time)
        onNodeWithText("9:30").assertIsDisplayed()
        onNodeWithTag(DtmDateTimeTestTags.ClearTime).assertHeightIsEqualTo(48.dp).performClick()
        assertNull(time)
    }
}
