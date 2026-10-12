# Delta for Countdown Units

## Purpose

Lets a day show its countdown or count-up in six units, the same in the app and on the share page.

## ADDED Requirements

### Requirement: Six unit modes
A day's unit mode SHALL be one of Auto, Days, Weeks, Hours, Calendar and Workdays (API values `auto`, `days`, `weeks`, `hours`, `calendar`, `workdays`), default Auto. Auto SHALL show days, then hours and minutes when less than 48 hours remain. Days SHALL show total days. Weeks SHALL show weeks and days ("22 w 4 d"). Hours SHALL show whole hours to the exact time. Calendar, shown "Y·M·D", SHALL show years, months and days.

#### Scenario: Weeks
- **WHEN** a day is 158 days away and its unit mode is Weeks
- **THEN** it shows "22 w 4 d"

#### Scenario: Auto in the last 48 hours
- **WHEN** a day in Auto mode is 30 hours and 15 minutes away
- **THEN** it shows 30 hours and 15 minutes

#### Scenario: Hours
- **WHEN** it is 09:30 on 12 October 2026 and a day without a time is on 14 October 2026 in the same zone
- **THEN** Hours shows 38

#### Scenario: Calendar
- **WHEN** it is 12 October 2026 and a day is on 20 February 2029
- **THEN** Calendar shows 2 years, 4 months and 8 days

### Requirement: Workdays
The Workdays unit SHALL count Monday to Friday only and SHALL skip Saturdays and Sundays. A countdown SHALL count the days after today up to and including the target day. A count-up SHALL count from the day after the start up to and including today. Public holidays SHALL NOT be skipped yet.

#### Scenario: Deadline two weeks away
- **WHEN** today is Monday 12 October 2026 and the target is Friday 23 October 2026
- **THEN** Workdays shows 9

#### Scenario: Target on a Saturday
- **WHEN** today is Monday 12 October 2026 and the target is Saturday 17 October 2026
- **THEN** Workdays shows 4

#### Scenario: Count-up over a weekend
- **WHEN** a count-up started on Friday 9 October 2026 and today is Monday 12 October 2026
- **THEN** Workdays shows 1

#### Scenario: Public holiday on a weekday
- **WHEN** a countdown runs over Friday 25 December 2026
- **THEN** that day is counted as a workday

### Requirement: Who changes the unit
The unit mode SHALL be a shared field. The owner and editors SHALL be able to change it. The backend SHALL reject a change from a viewer with `403 forbidden`. Members and the public link page SHALL show the day in the unit the owner or an editor chose.

#### Scenario: Editor sets Workdays
- **WHEN** an editor sets a shared day to Workdays
- **THEN** the owner, the other members and the public link page show the day in workdays

#### Scenario: Viewer tries to change the unit
- **WHEN** a viewer's client sends a change to `unitMode`
- **THEN** the response is `403 forbidden` and the unit is unchanged

### Requirement: Unit switch on the day page
For the owner and editors, tapping the number on the day page SHALL switch to the next unit in the order Auto, Days, Weeks, Hours, Calendar, Workdays, and a list SHALL offer all six. Viewers SHALL see no unit control.

#### Scenario: Cycle from Hours
- **WHEN** the owner taps the number of a day shown in Hours
- **THEN** the day shows Calendar and the change syncs like any other edit

#### Scenario: Viewer taps the number
- **WHEN** a viewer taps the number on the day page
- **THEN** the unit does not change and no unit list is offered

### Requirement: One engine and shared test vectors
The countdown engine in `:core:model` SHALL compute every unit mode. The test vectors generated from it SHALL cover every unit mode, and the app and the share page SHALL pass them.

#### Scenario: Share page in Workdays
- **WHEN** the app and the public link page show the same day in Workdays on the same date
- **THEN** both show the same number
