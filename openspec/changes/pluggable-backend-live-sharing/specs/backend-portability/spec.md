# Delta for Backend Portability

## Purpose

Lets the operator run the backend on Cloudflare, a self-hosted server, Vercel or Firebase, in one or more regions, without changing the app or the share web page.

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
Size limits, plan limits and rate limits SHALL be the same on every provider. They SHALL fit within the smallest platform limit of any supported provider, so no provider rejects a request that another accepts.

#### Scenario: Upload over the limit
- **WHEN** a client uploads a 4.2 MB file to any provider
- **THEN** the response is `413` with error code `payload_too_large`

#### Scenario: Upload at the limit
- **WHEN** a Premium user uploads a valid 4 MB animated photo to any provider
- **THEN** the upload succeeds

### Requirement: Deployment capabilities are discoverable
Each deployment SHALL report its live update mode (`ws` or `poll`), enabled sign-in methods, purchase stores and optional features such as Spotify links. The app and the share page SHALL offer only what the deployment reports, and SHALL use WebSocket notices in `ws` mode and conditional polling in `poll` mode.

#### Scenario: Deployment without Google sign-in
- **WHEN** a deployment does not enable Google sign-in
- **THEN** the app's sign-in screen shows no Google button

#### Scenario: Provider in poll mode
- **WHEN** the deployment reports live mode `poll` and a share page is open and visible
- **THEN** the page checks for changes at most once every 20 seconds and gets `304 Not Modified` while nothing changed

### Requirement: Regions are separate deployments
A region SHALL be an independent deployment with its own domain and data. An account and its events SHALL belong to one region. The app SHALL choose the region once per install and keep it.

#### Scenario: Region chosen once
- **WHEN** a user installs the app from a storefront mapped to a region and later travels abroad
- **THEN** the app keeps using the region it chose at first launch

### Requirement: Maintenance mode
The operator SHALL be able to put the backend in maintenance mode. In maintenance mode every write SHALL return `503` with error code `service_unavailable`, while reads and share pages keep working.

#### Scenario: Save during maintenance
- **WHEN** maintenance mode is on and an editor saves a change in the app
- **THEN** the backend returns `503 service_unavailable` and the app keeps the change queued for later

### Requirement: Operator storage report
The backend SHALL give the operator a storage report per account through `GET /api/v1/admin/storage` and a page at `/admin/storage`. Each row SHALL show the account id, display name, plan, file counts (still, motion, audio), bytes (media, documents), total bytes and last activity. The report SHALL be sortable by bytes (default, highest media bytes first), file count or last activity, 50 rows per page, with the same order on every supported provider.

#### Scenario: Largest accounts first
- **WHEN** the operator opens the storage report without choosing an order
- **THEN** it lists at most 50 accounts, the one with the most bytes of photos and audio first

### Requirement: Operator access
The storage report SHALL require the operator token (`Authorization: Bearer <ADMIN_TOKEN>`), which the apps never hold, and SHALL be limited to 60 requests per hour per IP. It SHALL be the only operator API.

#### Scenario: No operator token
- **WHEN** a client calls the storage report without the operator token, or with a wrong one
- **THEN** the response is `401 unauthorized` and contains no account data
