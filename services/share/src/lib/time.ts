export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** ISO-8601 UTC with `Z` and no milliseconds. */
export const iso = (seconds: number): string => new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

export const isoOrNull = (seconds: number | null): string | null => (seconds === null ? null : iso(seconds));

export const yyyymmdd = (seconds: number): string => new Date(seconds * 1000).toISOString().slice(0, 10).replaceAll('-', '');
