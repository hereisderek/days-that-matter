# Delta for Backend Portability

## Purpose

Lets the operator run the backend on Cloudflare, a self-hosted server, Vercel or Firebase without changing the app or the share web page.

## ADDED Requirements

### Requirement: One API contract on every provider
The backend SHALL expose the same HTTP API on every supported provider: the same paths, request and response bodies, status codes, error codes and headers. A client SHALL need only a different base URL to use another provider.

#### Scenario: App built against another provider
- **WHEN** an app build is configured with the self-hosted base URL instead of the Cloudflare one
- **THEN** sign-in, sync, sharing, history and backdrop uploads work with no other app change

#### Scenario: Same error on every provider
- **WHEN** a client sends an event with an empty title to any supported provider
- **THEN** the response is `400` with error code `invalid_payload` and field path `title` in `details`

### Requirement: Supported means conformance passes
A provider SHALL be listed as supported only while the backend conformance suite passes against it. CI SHALL run the suite for every provider variant on every change to the backend.

#### Scenario: Variant breaks conformance
- **WHEN** a change makes the Firebase variant fail a conformance test
- **THEN** CI fails and the change cannot merge

### Requirement: Same limits on every provider
Size limits, quotas and rate limits SHALL be the same on every provider. They SHALL fit within the smallest platform limit of any supported provider, so no provider rejects a request that another accepts.

#### Scenario: Upload over the limit
- **WHEN** a client uploads a 4.2 MB animated backdrop to any provider
- **THEN** the response is `413` with error code `payload_too_large`

#### Scenario: Upload at the limit
- **WHEN** a client uploads a valid 4 MB animated backdrop for a Premium owner's event to any provider
- **THEN** the upload succeeds

### Requirement: Live update mode is discoverable
The health endpoint SHALL report the backend version and its live update mode, `ws` or `poll`. Clients SHALL use WebSocket notifications in `ws` mode and conditional polling in `poll` mode.

#### Scenario: Provider in poll mode
- **WHEN** the backend reports live mode `poll` and a share page is open and visible
- **THEN** the page checks for changes at most once every 20 seconds and gets `304 Not Modified` while nothing changed

#### Scenario: Provider in ws mode
- **WHEN** the backend reports live mode `ws` and a share page is open
- **THEN** the page keeps one WebSocket open and makes no polling requests

### Requirement: Maintenance mode
The operator SHALL be able to put the backend in maintenance mode. In maintenance mode every write SHALL return `503` with error code `service_unavailable`, while reads and share pages keep working.

#### Scenario: Save during maintenance
- **WHEN** maintenance mode is on and an editor saves a change in the app
- **THEN** the backend returns `503 service_unavailable` and the app keeps the change queued for later
