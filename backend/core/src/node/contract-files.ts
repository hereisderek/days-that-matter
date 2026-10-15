// Node helpers that read the generated contract files from disk (scripts and tests only).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemaToTypeScript } from '../contract/schema-to-ts.ts';
import type { SchemaDocument } from '../contract/schema-to-ts.ts';

const root = (path: string): string => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export const SCHEMA_PATH = root('contract/api.schema.json');
export const API_TYPES_PATH = root('src/contract/api.ts');

const HEADER = `// Generated from backend/core/contract/api.schema.json by \`npm run contract:types\`. Do not edit.
// The schema itself is generated from :core:model (./gradlew :core:model:generateContract).`;

/** The source of src/contract/api.ts for the committed schema. */
export function renderApiTypes(): string {
  const doc = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as SchemaDocument;
  return schemaToTypeScript(doc, HEADER);
}

/** Reads a contract or web test file as JSON, relative to backend/core/. */
export function readCoreJson<T>(path: string): T {
  return JSON.parse(readFileSync(root(path), 'utf8')) as T;
}
