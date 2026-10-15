# Backend

TypeScript npm workspaces (design D1 of the change `pluggable-backend-live-sharing`). Architecture,
ports, data model and API: [`docs/architecture/BACKEND.md`](../docs/architecture/BACKEND.md).

- `core/`: all behavior. `src/` (HTTP layer, ports, `SqlStore`, store conformance suite),
  `migrations/` (SQLite), `web/` (share page assets, `countdown.js`), `contract/` (generated from
  `:core:model`, never edited by hand).
- Provider variants (`cloudflare/`, `selfhost/`, `vercel/`, `firebase/`) come in later tasks.

## Commands

Node 22.18 or newer (`node:sqlite` and TypeScript type stripping without flags).

```sh
cd backend
npm ci
npm run typecheck
npm run lint
npm test
```

After a change to the shared model: `cd mobile && ./gradlew :core:model:generateContract :core:model:generateCountdownVectors`,
then `npm run contract:types -w @days-that-matter/backend-core` to regenerate
`core/src/contract/api.ts`. A test fails while `api.ts` is stale; CI fails while the contract or the
vectors are stale.

## Versions

Latest stable releases, with two exceptions:
- TypeScript stays on 6.0: typescript-eslint 8.71 supports TypeScript below 6.1, and TypeScript 7 (the
  native compiler) is not supported by it yet. Move to 7 when typescript-eslint does.
- `@types/node` follows the oldest Node major the code runs on (22), so the types do not offer APIs that
  Node 22 lacks.
