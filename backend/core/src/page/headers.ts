import { pageHeaders } from '../http/headers.ts';

export const ORIGIN = 'https://daysthatmatter.app';
export const MEDIA_ORIGIN = 'https://media.daysthatmatter.app';

export const PAGE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  ...pageHeaders(ORIGIN, MEDIA_ORIGIN),
};

export const PAGE_CSP: string = PAGE_HEADERS['Content-Security-Policy'] as string;
