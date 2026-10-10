import { Hono } from 'hono';
import type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/v1/health', (c) =>
  c.json({ status: 'ok', time: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), version: c.env.VERSION ?? 'dev' }),
);

export default app;
