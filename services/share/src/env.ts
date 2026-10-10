export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RATE_SALT?: string;
  ADMIN_KEY?: string;
  MAINTENANCE?: string;
  VERSION?: string;
}
