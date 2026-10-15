// Turns backend/core/contract/api.schema.json (generated from :core:model) into TypeScript types.
// Handles exactly the subset JsonSchemaGenerator in mobile/core/model writes: $ref, const, enum, anyOf and
// oneOf, objects with properties, maps, arrays, and the primitive types. Anything else throws, so a
// new schema shape is never turned into a wrong type.

export interface JsonSchema {
  readonly $ref?: string;
  readonly type?: string;
  readonly const?: string;
  readonly enum?: readonly string[];
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: JsonSchema;
  readonly items?: JsonSchema;
  readonly format?: string;
  readonly pattern?: string;
}

export interface SchemaDocument {
  readonly $defs: Readonly<Record<string, JsonSchema>>;
}

const KNOWN_KEYS = new Set([
  '$ref', 'type', 'const', 'enum', 'anyOf', 'oneOf', 'properties', 'required', 'additionalProperties', 'items',
  'format', 'pattern',
]);

const REF_PREFIX = '#/$defs/';

/** The TypeScript source for every type in `doc.$defs`, in the order of `$defs`. */
export function schemaToTypeScript(doc: SchemaDocument, header: string): string {
  const out = [header.trimEnd(), ''];
  for (const [name, schema] of Object.entries(doc.$defs)) {
    out.push(declaration(name, schema, doc), '');
  }
  return out.join('\n');
}

function declaration(name: string, schema: JsonSchema, doc: SchemaDocument): string {
  checkKeys(schema, name);
  const comment = describe(schema);
  if (schema.type === 'object' && schema.properties) {
    return `${comment}export interface ${name} ${objectType(schema, doc, '')}`;
  }
  return `${comment}export type ${name} = ${typeOf(schema, doc, '')};`;
}

function describe(schema: JsonSchema): string {
  if (schema.format) return `/** Format: ${schema.format}. */\n`;
  if (schema.pattern) return `/** Pattern: \`${schema.pattern}\`. */\n`;
  return '';
}

function typeOf(schema: JsonSchema, doc: SchemaDocument, indent: string): string {
  checkKeys(schema, JSON.stringify(schema));
  if (schema.$ref !== undefined) {
    if (!schema.$ref.startsWith(REF_PREFIX)) throw new Error(`Unsupported $ref ${schema.$ref}`);
    const target = schema.$ref.slice(REF_PREFIX.length);
    if (!(target in doc.$defs)) throw new Error(`Missing definition ${target}`);
    return target;
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum !== undefined) return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  const union = schema.anyOf ?? schema.oneOf;
  if (union !== undefined) return union.map((s) => wrap(typeOf(s, doc, indent))).join(' | ');
  switch (schema.type) {
    case undefined:
      return 'unknown';
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      if (!schema.items) throw new Error('Array without items');
      return `${wrap(typeOf(schema.items, doc, indent))}[]`;
    case 'object':
      if (schema.properties) return objectType(schema, doc, indent);
      if (schema.additionalProperties) return `Record<string, ${typeOf(schema.additionalProperties, doc, indent)}>`;
      return 'Record<string, unknown>';
    default:
      throw new Error(`Unsupported type ${schema.type}`);
  }
}

function objectType(schema: JsonSchema, doc: SchemaDocument, indent: string): string {
  const required = new Set(schema.required ?? []);
  const inner = `${indent}  `;
  const lines = Object.entries(schema.properties ?? {}).map(([key, value]) => {
    const optional = required.has(key) ? '' : '?';
    const comment = describe(value).replace('\n', '');
    const prefix = comment ? `${inner}${comment}\n` : '';
    return `${prefix}${inner}${key}${optional}: ${typeOf(value, doc, inner)};`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

function wrap(type: string): string {
  return type.includes(' | ') ? `(${type})` : type;
}

function checkKeys(schema: JsonSchema, where: string): void {
  for (const key of Object.keys(schema)) {
    if (!KNOWN_KEYS.has(key)) throw new Error(`Unsupported schema keyword ${key} in ${where}`);
  }
}
