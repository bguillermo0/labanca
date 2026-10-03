// Pruebas de la lógica de La Banca (sin red ni Netlify). Ejecutar: npm test
import assert from 'node:assert/strict';
import { handle } from './netlify/functions/core.mjs';
import { TOKENS } from './netlify/functions/tokens.mjs';

const mem = new Map();
const store = { get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null), set: async (k, v) => { mem.set(k, structuredClone(v)); } };
const call = (method, parts, body) => handle({ method, parts, body }, store, TOKENS);
const bank = (action, body) => call('POST', ['b', TOKENS.banca, action], body);

// Lectura de equipos
let r = await call('GET', ['t', TOKENS.novatos]);
assert.deepEqual([r.status, r.json.name, r.json.balance], [200, 'NOVATOS', 500]);
r = await call('GET', ['t', TOKENS.veteranos]);
assert.deepEqual([r.status, r.json.name, r.json.balance], [200, 'VETERANOS', 500]);

// Seguridad: tokens falsos, token de equipo en rutas de banca, métodos
assert.equal((await call('GET', ['t', 'abc'])).status, 404);
assert.equal((await call('GET', ['t', ''])).status, 404);
assert.equal((await call('POST', ['b', TOKENS.novatos, 'adjust'], { team: 'novatos', delta: 1000 })).status, 404);
assert.equal((await call('POST', ['b', 'x', 'adjust'], { team: 'novatos', delta: 1000 })).status, 404);
assert.equal((await call('GET', ['b', TOKENS.novatos])).status, 404);
assert.equal((await call('POST', ['t', TOKENS.novatos], {})).status, 404);
assert.equal((await call('GET', ['t', TOKENS.novatos])).json.balance, 500, 'los intentos de trampa no cambian nada');

// Operaciones de la banca
r = await bank('adjust', { team: 'novatos', delta: -120 });
assert.equal(r.status, 200); assert.equal(r.json.teams.novatos.balance, 380); assert.equal(r.json.teams.veteranos.balance, 500);
await bank('adjust', { team: 'veteranos', delta: 50 });
assert.equal((await call('GET', ['t', TOKENS.novatos])).json.balance, 380, 'el equipo ve el cambio');
assert.equal((await call('GET', ['t', TOKENS.veteranos])).json.balance, 550);

r = await bank('adjust', { team: 'novatos', delta: 0.1 });
r = await bank('adjust', { team: 'novatos', delta: 0.2 });
assert.equal(r.json.teams.novatos.balance, 380.3, 'sin errores de coma flotante');

r = await bank('set', { team: 'novatos', balance: 777 });
assert.equal(r.json.teams.novatos.balance, 777);

// Validaciones
assert.equal((await bank('adjust', { team: 'novatos', delta: 'abc' })).status, 400);
assert.equal((await bank('adjust', { team: 'novatos', delta: null })).status, 400);
assert.equal((await bank('adjust', { team: 'novatos', delta: 1e12 })).status, 400);
assert.equal((await bank('adjust', { team: 'otros', delta: 5 })).status, 400);
assert.equal((await bank('adjust', { team: '__proto__', delta: 5 })).status, 400);
assert.equal((await bank('borrar', {})).status, 404);

// Deshacer
r = await bank('undo', {});
assert.equal(r.json.teams.novatos.balance, 380.3);
const revBefore = r.json.rev;

// Sin cambios no sube la revisión
r = await bank('adjust', { team: 'novatos', delta: 0 });
assert.equal(r.json.rev, revBefore);

// Revisión estrictamente creciente
r = await bank('adjust', { team: 'novatos', delta: 5 });
assert.ok(r.json.rev > revBefore);

// Reinicio
r = await bank('reset', {});
assert.deepEqual([r.json.teams.novatos.balance, r.json.teams.veteranos.balance], [500, 500]);
assert.ok(r.json.hist.some((h) => h.note === 'reinicio'));

// Deshacer sin historial
for (let i = 0; i < 100; i++) { const x = await bank('undo', {}); if (x.status === 400) { assert.equal(x.json.error, 'No hay nada que deshacer'); break; } }

// Historial acotado
for (let i = 0; i < 90; i++) await bank('adjust', { team: 'novatos', delta: 1 });
assert.ok((await call('GET', ['b', TOKENS.banca])).json.hist.length <= 60);

console.log('Todas las pruebas pasan.');
