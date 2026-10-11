# Delta for Premium

## Purpose

Defines the plans (Free, Premium and a reserved Premium Plus), the limits of each, how users buy and restore them, and how the app and the backend enforce them the same way.

## ADDED Requirements

### Requirement: Plans and one plan table
Every account SHALL have one plan: free, premium or premium_plus; guests SHALL follow the free plan on the device. One plan table SHALL hold every feature and limit per plan. The app and the backend SHALL use the same table, built from one shared definition, and the premium feature doc SHALL list the same values.

#### Scenario: Limit changed in the table
- **WHEN** the free event limit in the plan table changes from 10 to 15
- **THEN** the app's check and the backend's check both use 15 after the release, with no other code change

### Requirement: Free plan limits
The free plan SHALL limit owned events (initial value 10), photo backdrops in use (5) and Spotify events (3), SHALL include free built-in tracks only, and SHALL exclude animated photos and custom audio files.

#### Scenario: Eleventh event
- **WHEN** a free user with 10 owned events creates another
- **THEN** the paywall appears and the event is not created

### Requirement: Paid plans have limits too
Paid plans SHALL also have limits, to prevent abuse. Premium SHALL allow 500 owned events, 300 photo backdrops in use, 30 animated photos in use and 20 custom audio files in use (initial values). Over a paid limit, the app SHALL say the limit is reached and the backend SHALL return `429 quota_exceeded`.

#### Scenario: Premium at the custom audio limit
- **WHEN** a Premium user with 20 custom audio files in use adds another
- **THEN** the app says the limit is reached and nothing is uploaded

### Requirement: Premium Plus is reserved
The premium_plus plan SHALL include everything in premium. Until features are assigned to it, the app SHALL NOT offer it for sale.

#### Scenario: Store listing
- **WHEN** a user opens the paywall
- **THEN** only Premium is offered

### Requirement: Gating follows the writer's plan
Adding paid content SHALL require the plan of the user saving it, on their own events and on events they edit for someone else. Counted limits SHALL count what that user added; the owned-event limit SHALL count the owner's events. Viewing SHALL never depend on the viewer's plan.

#### Scenario: Backend check
- **WHEN** a modified client of a free user saves a Premium track on an event whose owner has Premium
- **THEN** the backend rejects the change with `402 premium_required` and `details.feature` set to `premium_audio`

### Requirement: Try before buying
A user on a plan without a feature SHALL be able to pick and preview it. Saving it SHALL show the paywall, which SHALL offer the upgrade and, where one exists, a free alternative.

#### Scenario: Paywall with alternative
- **WHEN** a free user taps Save on an animated photo backdrop
- **THEN** the paywall shows "Upgrade" and "Use still photo"

### Requirement: Limits never delete content
Reaching a limit, or a plan ending, SHALL NOT delete or hide anything. It SHALL only block adding more. Existing animated photos, tracks, audio files and Spotify links SHALL keep working for everyone.

#### Scenario: Subscription lapses
- **WHEN** a user with 20 photo backdrops, 8 animated photos and 5 Spotify events lets Premium lapse
- **THEN** everything keeps working, and adding another photo, animated photo or Spotify link shows the paywall

#### Scenario: Guest data above the free limit
- **WHEN** a free user signs in and their local and account events total 14
- **THEN** all 14 events are kept and creating a new one shows the paywall

### Requirement: Purchase and restore
Users SHALL buy Premium as an App Store or Google Play subscription inside the app. A guest SHALL be able to buy, and the purchase SHALL attach to their account when they sign in. "Restore purchases" SHALL restore the plan on a new device. The web page SHALL NOT sell plans.

#### Scenario: Guest buys, then signs in
- **WHEN** a guest buys Premium and later signs in
- **THEN** their account has Premium on every device

### Requirement: Backend verifies purchases with the stores
The backend SHALL decide an account's plan from purchase records it verified with Apple or Google, never from what the app reports. After a purchase or restore, the plan SHALL be active on the backend within 1 minute. Renewals, refunds and expiry SHALL update the plan within 24 hours.

#### Scenario: Plan after purchase
- **WHEN** a user completes a purchase and saves an animated photo 10 seconds later
- **THEN** the backend accepts it

#### Scenario: Forged plan
- **WHEN** a patched app claims Premium for an account with no purchase
- **THEN** the backend still treats the account as free

#### Scenario: Refund
- **WHEN** Apple refunds a Premium subscription
- **THEN** within 24 hours the account is on the free plan and its existing content keeps working
