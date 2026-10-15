# API Design Conventions

How the backend's HTTP API is shaped. These rules come from established practice (REST resource design, HTTP semantics, RFC 9110 and RFC 9457-style error handling). The endpoint list is in [`BACKEND.md`](../architecture/BACKEND.md) section 7; the reasoning for the bulk routes is in design D22 of the change `pluggable-backend-live-sharing`.

An owner suggestion for an endpoint is an input to review, not an instruction. Check it against these rules, choose the better shape, and write the reason down (see Decisions at the end).

## 1. Resources, methods, status codes

- Paths name resources with plural nouns: `/events`, `/events/{id}/memos/{memoId}`. A verb appears only for an operation that is not a plain create, update or read (`/auth/token`, `/events/{id}/restore`).
- `GET` reads and never changes state. `PUT` creates or replaces at a client-chosen id and is idempotent. `PATCH` changes some fields. `POST` creates under a collection or runs an action. `DELETE` removes.
- Status codes: `200` read or repeat, `201` created, `202` accepted and not done yet, `204` no body, `304` unchanged, `400` invalid request, `401` no or bad token, `402` plan needed, `403` not allowed, `404` not found or not visible, `409` conflict, `410` gone, `413` too large, `415` wrong media type, `429` rate or quota limit, `5xx` server.
- `404` rather than `403` when the caller must not learn that a resource exists.

## 2. Writes that can be repeated

- The client creates ids (UUIDs). Repeating a create with the same id and the same content returns the stored resource; the same id with different content is `409 conflict`. A lost response never causes a duplicate.
- Updates carry the revision they are based on (`baseRev`); the server merges per field and reports what it overwrote.

## 3. Bulk operations

Bulk writes are sub-resources of the collection, never a flag on the single route.

| | `POST /events/batch` | `POST /events/import` |
| :--- | :--- | :--- |
| Meaning | many creates, to save requests | moving events in from another place |
| Size | up to 100 events | up to 500 events, 4 MB |
| Result | one result per event; one invalid event does not stop the others | all or nothing; `409` or `400` fails everything |
| Limits | each event is checked like a single create, including the owned-event limit | skips the owned-event limit only; every other rule applies |
| Response | `{results: [{id, status, error?}]}` | `{imported: [{id, unstoredFields}]}` |

Both run one shared handler. The route chooses the policy (`atomic`, `enforceOwnedLimit`); a request field never does.

## 4. Errors

One envelope everywhere: `{"error": {"code", "message", "details"}}`. `code` is stable and machine-readable (`invalid_payload`, `premium_required`, `quota_exceeded`, `rate_limited`, `conflict`, `unauthorized`); `message` is for logs, not for users (see [`USER_COPY.md`](USER_COPY.md)); `details` carries the field path or the feature. `5xx` bodies carry only a request id. Never put secrets, tokens or user content in an error.

## 5. Lists, caching and limits

- Lists use cursor pagination: `?limit=` and `?after=<opaque cursor>`, response `{items, next}`. No offsets.
- Cacheable reads send an `ETag` and answer `If-None-Match` with `304` (`/sync`, `/audio/catalog`, `/remote-config`).
- Rate-limit responses are `429 rate_limited` with `Retry-After`. Counters hash IPs and never store them raw.

## 6. Versioning

- Every JSON API route is under `/api/v1/`. A breaking change gets `/api/v2/`; additive changes (a new field, a new endpoint) do not.
- Unversioned, because a version means nothing there: the share pages `/e`, `/i`, `/s`, `/auth/apple/callback` (Apple fixes the URL), `/export/{token}`, `/admin/*`, `/.well-known/*`.
- Requests are validated strictly: an unknown field is `400 invalid_payload`, so a version difference is never silently dropped. Readers are tolerant: a client ignores unknown fields in responses and unknown remote-config keys.

## 7. Protection

- Every route needs the bearer access token (`Authorization: Bearer st_…`), except the public list in `BACKEND.md` section 7.1. A new public route needs a reason written next to it.
- Operator routes take their own secret (`ADMIN_TOKEN`), never a user token.
- Authorization is decided by the token and the stored data. Never trust a client-supplied flag or identifier for it: not a `user` parameter, not an "import" flag on a normal create, not a role in a body. A parameter may only narrow or hint, and the server ignores it unless the token agrees.
- Limits are enforced on the server whatever the app shows; the server's `402` or `429` wins over the app's copy of the rules.

## Decisions (owner suggestions reviewed)

| Suggestion | Outcome | Reason |
| :--- | :--- | :--- |
| `/import` for moving local events | `POST /api/v1/events/import` | A noun path under the collection it creates. A top-level `/import` does not say what is imported and has no natural place for other imports. |
| A parameter on the normal create that marks a local import and skips the limit | Rejected | The client controls it, so any client could skip the plan limit. The policy comes from the route. |
| A generic batch create to cut calls | `POST /api/v1/events/batch` | Per-event results fit offline sync, where one bad event must not block the rest. It keeps the limit. |
| A `user` parameter on `GET /remote-config` | Kept only as an audience hint | Used only when it equals the token's account; otherwise the audience is `local`. Without that, anyone could read another account's targeted values. |
| All-or-nothing import | Kept, in the route and in the app | A partial result cannot be verified by the app or explained to the user. |
