# Delta for Premium

## Purpose

Defines the plans (Free, Premium and a reserved Premium Plus), which features each includes, how users buy and restore them, and how the app and the backend enforce them the same way.

## ADDED Requirements

### Requirement: Plans and one plan table
Every account SHALL have one plan: free, premium or premium_plus. One plan table SHALL define which features and limits each plan includes. The app and the backend SHALL use the same table, built from one shared definition, and the premium feature doc SHALL list the same entries.

#### Scenario: Limit changed in the table
- **WHEN** the free Spotify limit in the plan table changes from 3 to 5 events
- **THEN** the app's paywall check and the backend's check both use 5 after the release, with no other code change

### Requirement: Premium Plus is reserved
The premium_plus plan SHALL include everything in premium. Until features are assigned to it, the app SHALL NOT offer it for sale.

#### Scenario: Store listing
- **WHEN** a user opens the paywall
- **THEN** only Premium is offered

### Requirement: Try before buying
A user on a plan without a feature SHALL be able to pick and preview it. Saving it SHALL show the paywall, which SHALL offer the upgrade and, where one exists, a free alternative.

#### Scenario: Paywall with alternative
- **WHEN** a free user taps Save on an animated photo backdrop
- **THEN** the paywall shows "Upgrade" and "Use still photo"

### Requirement: Gating follows the event owner's plan
Premium checks on an event SHALL use the plan of the event's owner, for every writer, in the app and on the backend. Viewing an event SHALL never depend on the viewer's plan.

#### Scenario: Backend check
- **WHEN** a modified client saves a Premium track on an event whose owner is on the free plan
- **THEN** the backend rejects the change with `402 premium_required` and `details.feature` set to `premium_audio`

### Requirement: Purchase and restore
Users SHALL buy Premium as an App Store or Google Play subscription inside the app. A guest SHALL be able to buy, and the purchase SHALL attach to their account when they sign in. "Restore purchases" SHALL restore the plan on a new device. The web page SHALL NOT sell plans.

#### Scenario: Guest buys, then signs in
- **WHEN** a guest buys Premium and later signs in
- **THEN** their account has Premium on every device

### Requirement: Backend verifies the plan
The backend SHALL decide an account's plan from the store purchase records, never from what the app reports. After a purchase or restore, the plan SHALL be active on the backend within 1 minute. The backend SHALL re-check a plan when it has expired.

#### Scenario: Plan after purchase
- **WHEN** a user completes a purchase and saves an animated photo 10 seconds later
- **THEN** the backend accepts it

#### Scenario: Forged plan
- **WHEN** a patched app claims Premium for an account with no purchase
- **THEN** the backend still treats the account as free

### Requirement: Ending Premium keeps existing content
When a subscription ends, existing Premium content SHALL keep working for everyone: animated backdrops keep playing, Premium tracks keep playing and Spotify links stay. Adding new Premium content SHALL then follow the free plan.

#### Scenario: Subscription lapses
- **WHEN** an owner with 5 Spotify events and an animated backdrop lets Premium lapse
- **THEN** all 5 links and the animated backdrop keep working, and linking Spotify on a sixth event shows the paywall
