export type SqlValue = string | number | bigint | Uint8Array | null;
export type SqlRow = Record<string, SqlValue>;

export interface SqlStatement {
  readonly sql: string;
  readonly args?: readonly SqlValue[];
}

/**
 * The only persistence code an SQL variant writes (D1, node:sqlite, libSQL). SQLite dialect,
 * positional `?` parameters.
 */
export interface SqlDriver {
  query<T extends SqlRow = SqlRow>(sql: string, args?: readonly SqlValue[]): Promise<T[]>;
  /** Runs the statements in one transaction, in order; returns the rows each one changed. All or nothing. */
  batch(statements: readonly SqlStatement[]): Promise<number[]>;
}
