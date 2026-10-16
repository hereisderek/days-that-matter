package dev.derek.daysthatmatter.feature.settings.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class GreetingTest {

    @Test
    fun morningGreetingBetween5And11() {
        assertEquals("Good morning, Sam", Greeting.format(5, "Sam"))
        assertEquals("Good morning, Sam", Greeting.format(9, "Sam"))
        assertEquals("Good morning, Sam", Greeting.format(11, "Sam"))
        assertEquals("Good morning", Greeting.format(9, null))
        assertEquals("Good morning", Greeting.format(9, ""))
        assertEquals("Good morning", Greeting.format(9, "   "))
    }

    @Test
    fun afternoonGreetingBetween12And16() {
        assertEquals("Good afternoon, Sam", Greeting.format(12, "Sam"))
        assertEquals("Good afternoon, Sam", Greeting.format(14, "Sam"))
        assertEquals("Good afternoon, Sam", Greeting.format(16, "Sam"))
        assertEquals("Good afternoon", Greeting.format(14, null))
        assertEquals("Good afternoon", Greeting.format(14, ""))
    }

    @Test
    fun eveningGreetingFrom17ThroughNight() {
        assertEquals("Good evening, Sam", Greeting.format(17, "Sam"))
        assertEquals("Good evening, Sam", Greeting.format(20, "Sam"))
        assertEquals("Good evening, Sam", Greeting.format(23, "Sam"))
        assertEquals("Good evening, Sam", Greeting.format(0, "Sam"))
        assertEquals("Good evening, Sam", Greeting.format(4, "Sam"))
        assertEquals("Good evening", Greeting.format(20, null))
        assertEquals("Good evening", Greeting.format(23, ""))
    }

    @Test
    fun nameIsTrimmed() {
        assertEquals("Good morning, Alex", Greeting.format(9, "  Alex  "))
        assertEquals("Good evening, Charlie", Greeting.format(19, "Charlie  "))
    }
}
