import { Hono } from 'hono';
import type { AppEnv } from '../lib/headers';
import { iso, nowSeconds } from '../lib/time';

export const healthRoutes = new Hono<AppEnv>();

// Does not touch D1.
healthRoutes.get('/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ status: 'ok', time: iso(nowSeconds()), version: c.env.VERSION ?? 'dev' });
});
