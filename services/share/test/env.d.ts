import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ASSETS: Fetcher;
      RATE_SALT?: string;
      ADMIN_KEY?: string;
      MAINTENANCE?: string;
      VERSION?: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
export {};
