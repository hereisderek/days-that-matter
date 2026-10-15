# Delta for Premium

## Purpose

Defines the plans (Free, Premium and a reserved Premium Plus), the limits of each, how users buy and restore them, and how the app and the backend enforce them the same way.

## ADDED Requirements

### Requirement: Plans and one plan table
Every account SHALL have one plan: free, premium or premium_plus; local mode SHALL follow the free plan on the device. The values SHALL be adjustable without a release through the remote configuration (remote-config spec). One plan table SHALL hold every feature and limit per plan. The app and the backend SHALL use the same table, built from one shared definition, and the premium feature doc SHALL list the same values.

#### Scenario: Limit changed in the table
- **WHEN** the free event limit in the plan table changes from 20 to 30 in the remote configuration
- **THEN** the backend's check uses 30 at once and the app's check uses 30 after it has read the new value, with no release

### Requirement: Free plan limits
The free plan SHALL limit owned events (initial value 20), photo backdrops in use (5) and Spotify events (5), SHALL include free built-in tracks only, and SHALL exclude animated photos and custom audio files. There SHALL be one limit for events, counted in events, and no separate count of days.

#### Scenario: Twenty-first event
- **WHEN** a free user with 20 owned events creates another
- **THEN** the paywall appears and the event is not created

### Requirement: Paid plans have limits too
Paid plans SHALL also have limits, to prevent abuse. Premium SHALL allow 500 owned events, 300 photo backdrops in use, 30 animated photos in use and 20 custom audio files in use (initial values, adjustable through the remote configuration). Over a paid limit, the app SHALL say the limit is reached and the backend SHALL return `429 quota_exceeded`.

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

#### Scenario: Imported events above the free limit
- **WHEN** a free user with 18 account events imports 14 local events
- **THEN** all 32 events are kept and creating a new one shows the paywall

### Requirement: Purchase and restore
Users SHALL buy Premium as an App Store or Google Play subscription inside the app. A local-mode user SHALL be able to buy, and the purchase SHALL attach to their account when they sign in; the purchase moves the plan, never the events, which only an import moves. "Restore purchases" SHALL restore the plan on a new device. The web page SHALL NOT sell plans.

#### Scenario: Local user buys, then signs in
- **WHEN** a local-mode user buys Premium and later signs in
- **THEN** their account has Premium on every device

### Requirement: Backend verifies purchases with the stores
The backend SHALL decide an account's plan from purchase records it verified with Apple or Google and from operator grants, never from what the app reports. After a purchase or restore, the plan SHALL be active on the backend within 1 minute. Renewals, refunds and expiry SHALL update the plan within 24 hours.

#### Scenario: Plan after purchase
- **WHEN** a user completes a purchase and saves an animated photo 10 seconds later
- **THEN** the backend accepts it

#### Scenario: Forged plan
- **WHEN** a patched app claims Premium for an account with no purchase
- **THEN** the backend still treats the account as free

#### Scenario: Refund
- **WHEN** Apple refunds a Premium subscription
- **THEN** within 24 hours the account is on the free plan and its existing content keeps working

### Requirement: Promotional grants
The operator SHALL be able to grant a plan to an account for a period, without a store purchase (for example, free Premium for a month). An account's plan SHALL be the highest of its active store purchases and its active grants. When a grant ends, the rule "Limits never delete content" SHALL apply: content added and quota used during the grant SHALL stay and keep working, and only adding more above the plan's limits SHALL be blocked.

#### Scenario: Promotion ends
- **WHEN** a free user gets a one-month Premium grant, adds 3 animated photos and 15 events, and the grant ends
- **THEN** all 15 events and the 3 animated photos keep working for everyone, and creating another event or saving another animated photo shows the paywall

#### Scenario: Grant and subscription
- **WHEN** a user with an active grant also buys Premium in the store
- **THEN** the account stays on Premium, and it remains Premium after the grant ends while the subscription is active

### Requirement: Paywall shows the current limits
The paywall and the usage rows in Settings SHALL be built from the current plan table in the remote configuration. A limit or feature that is not in the current configuration SHALL NOT appear in either.

#### Scenario: Limit removed from the paywall
- **WHEN** the operator removes the Spotify limit from the configuration
- **THEN** the paywall no longer lists a Spotify limit after the app has read the new configuration
