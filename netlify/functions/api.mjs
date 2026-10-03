import { getStore } from '@netlify/blobs';
import { handle } from './core.mjs';
import { TOKENS } from './tokens.mjs';

export default async (req) => {
  const parts = new URL(req.url).pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  let body = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }

  // consistency "strong": cada lectura ve la última escritura de la banca
  const blobs = getStore({ name: 'banca', consistency: 'strong' });
  const store = {
    get: (key) => blobs.get(key, { type: 'json' }),
    set: (key, value) => blobs.setJSON(key, value),
  };

  const out = await handle({ method: req.method, parts, body }, store, TOKENS);
  return new Response(JSON.stringify(out.json), {
    status: out.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: '/api/*' };
