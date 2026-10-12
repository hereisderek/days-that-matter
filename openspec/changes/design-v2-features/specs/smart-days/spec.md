# Delta for Smart Days

## Purpose

Draft. Smart days are days computed from a rule instead of one date, such as the days left this year, plus seasonal templates offered for a limited time. Open questions are in this change's design.md (D8).

## ADDED Requirements

### Requirement: Smart day rules
The app SHALL offer smart days computed from these rules: days left this year, with progress through the year; weekends left this year; public holidays left this year, from the region's holiday set; and workdays left this year (Monday to Friday minus public holidays).

#### Scenario: Days left this year
- **WHEN** a user adds "Days left this year" on 12 October 2026
- **THEN** it shows 80 days and the progress through 2026

### Requirement: Seasonal templates
Seasonal templates SHALL be offered only inside their season window, for example a Christmas countdown from 1 November to 25 December. The list of templates and their windows SHALL come from a backend catalog and SHALL change without an app release.

#### Scenario: Before the season
- **WHEN** a user browses templates on 12 October
- **THEN** the Christmas countdown is not offered

#### Scenario: In the season
- **WHEN** a user browses templates on 1 November
- **THEN** the Christmas countdown is offered

### Requirement: Holiday sets per region
Public holiday sets SHALL come from the backend per region and year (`GET /holidays/{region}/{year}`). The app SHALL cache them and SHALL use the cache offline.

#### Scenario: Offline
- **WHEN** a user opens "Public holidays left this year" without a network after it loaded once
- **THEN** the app shows the count from the cached holiday set

### Requirement: What smart days can do
Smart days SHALL be listed under a "Smart" category and SHALL be pinnable, customizable and archivable like other days. They SHALL NOT be shareable yet.

#### Scenario: Share a smart day
- **WHEN** a user opens the menu of a smart day
- **THEN** it offers Pin, Customize and Archive, and no public link or invite
