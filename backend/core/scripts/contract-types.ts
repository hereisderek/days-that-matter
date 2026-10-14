// Writes src/contract/api.ts from contract/api.schema.json. Run with `npm run contract:types` after
// `./gradlew :core:model:generateContract`; test/contract/api-types.test.ts fails while it is stale.
import { writeFileSync } from 'node:fs';
import { API_TYPES_PATH, renderApiTypes } from '../src/node/contract-files.ts';

writeFileSync(API_TYPES_PATH, renderApiTypes());
console.log(`wrote ${API_TYPES_PATH}`);
