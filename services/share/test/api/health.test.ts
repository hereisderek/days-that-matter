import { SELF } from 'cloudflare:test';
import { it, expect } from 'vitest';

it('health returns ok', async () => {
  const res = await SELF.fetch('https://x.test/api/v1/health');
  expect(res.status).toBe(200);
  expect((await res.json<{ status: string }>()).status).toBe('ok');
});
