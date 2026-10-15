# Delta for Remote Config

## Purpose

Lets the operator change limits, plan values, media thresholds and behavior rules without releasing the app, without slowing the app's launch, and without tying the app to one provider.

## ADDED Requirements

### Requirement: One remote configuration document
`GET /api/v1/remote-config` SHALL return a versioned JSON document: `{version, ttlSeconds, audience, values}`, where `values` maps each key to `{value, delivery}`. The response SHALL carry an ETag and answer `304` when unchanged. The request SHALL NOT require a token.

#### Scenario: Local audience
- **WHEN** a local-mode app requests the configuration with no token and no `user` parameter
- **THEN** it receives the values for the audience `local`, and the request carries no identifier

### Requirement: Audience of the configuration
The request MAY carry the bearer token; when it does, the audience is that account, otherwise the audience is `local`. A `user` query parameter MAY name the audience (a user id, or `local`), but the backend SHALL use a user id only when it matches the token's account and SHALL otherwise answer for the audience `local`, because anyone could otherwise read another account's targeted values.

#### Scenario: Signed-in audience
- **WHEN** a signed-in app requests the configuration with its token
- **THEN** it receives the values for that account

#### Scenario: Someone else's user id
- **WHEN** a request carries `user=<another account's id>` with no matching token
- **THEN** the response is the audience `local`

### Requirement: Background and blocking delivery
Each key SHALL have a delivery class. A `background` key (the default) SHALL never delay launch: the app SHALL read the cached value, fetch the document after launch, and apply a newer value the next time the value is read or the next launch. A `blocking` key, used rarely, SHALL be awaited at launch for at most 1.5 seconds; on a timeout or error the app SHALL use the cached value, then the compiled-in default, and SHALL NOT retry in a way that holds up launch.

#### Scenario: Background value changes
- **WHEN** the operator changes a background value while the app is closed
- **THEN** the app launches at normal speed with the old value, fetches the new one after launch, and uses it from the next read or launch

#### Scenario: Blocking value, slow network
- **WHEN** the app launches on a very slow network and a blocking key does not arrive within 1.5 seconds
- **THEN** launch continues with the cached or default value

### Requirement: Defaults and safety
Every key SHALL have a compiled-in default and an allowed range. The app SHALL ignore unknown keys and SHALL use the default for a value that is missing or outside its range, so a mistake in the configuration cannot break the app. The configuration SHALL contain data only, never code.

#### Scenario: Out-of-range value
- **WHEN** the configuration sets the Free event limit to -5
- **THEN** the app uses its default limit

### Requirement: Limits, plan values and thresholds are configuration
The plan table (every limit and feature per plan), the media thresholds (largest photo size in bytes and edge in pixels, largest motion part and audio file) and the sign-in suggestion rules SHALL be keys of the remote configuration, with compiled-in defaults from the shared model. The app SHALL show a limit, a usage row or a paywall item only for what exists in the current configuration: a limit removed from the configuration SHALL disappear from Settings and from the paywall.

#### Scenario: Limit removed
- **WHEN** the operator removes the Spotify limit from the Free plan in the configuration
- **THEN** after the app reads the new value, Settings shows no Spotify usage row and the paywall does not mention it

### Requirement: The backend is the authority and the app adapts files
The backend SHALL enforce the current values and SHALL be the authority; when the app's copy is out of date, the backend's answer (`402` or `429`) wins and the app refreshes its configuration. The app SHALL compress or convert a photo, motion part or audio file that exceeds the configured size or resolution, so the user never resizes anything.

#### Scenario: Limit raised
- **WHEN** the operator changes the Free event limit from 20 to 30
- **THEN** the backend allows the 21st event at once, and the app allows it after it has read the new value

#### Scenario: Large photo
- **WHEN** a user picks a photo larger than the configured size or resolution
- **THEN** the app compresses it to fit before uploading, with no prompt

### Requirement: The provider can be swapped
The app SHALL read configuration through one interface and the backend SHALL load its values through one port. A deployment MAY back them with a static file or asset served by the backend (the default), an HTTP source, or a third-party service such as Firebase Remote Config, with no change to the document format the app sees. The configuration SHALL be possible to run as part of the backend or separately from it.

#### Scenario: Third-party provider
- **WHEN** a deployment on Cloudflare uses Firebase Remote Config as its source
- **THEN** the app still receives the same document and the backend enforces the same values

### Requirement: Remote configuration in local mode
In local mode the app SHALL fetch the remote configuration with no token, no user or device identifier and no cookie, and SHALL work from the compiled-in defaults when it cannot.

#### Scenario: Offline local user
- **WHEN** a local user with no network opens the app
- **THEN** it works with the cached or default values
