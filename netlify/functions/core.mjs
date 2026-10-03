// Lógica de La Banca, independiente de Netlify para poder probarla en local.
import { timingSafeEqual } from 'node:crypto';

export const INITIAL = 500;
export const TEAMS = { novatos: 'NOVATOS', veteranos: 'VETERANOS' };
const KEY = 'estado';
const MAX_HIST = 60;

const same = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};
const r2 = (n) => Math.round(n * 100) / 100;
const fresh = () => ({ novatos: INITIAL, veteranos: INITIAL, hist: [], rev: 0 });

const teamView = (s, k) => ({ name: TEAMS[k], balance: s[k], rev: s.rev });
const bankView = (s) => ({
  teams: Object.fromEntries(Object.keys(TEAMS).map((k) => [k, { name: TEAMS[k], balance: s[k] }])),
  hist: s.hist,
  rev: s.rev,
});

// req: { method, parts: ['t'|'b', token, action?], body }
// store: { get(key) -> obj|null, set(key, obj) }
export async function handle(req, store, tokens) {
  const [kind, token, action] = req.parts;
  const state = (await store.get(KEY)) || fresh();

  if (kind === 't' && req.parts.length === 2 && req.method === 'GET') {
    const team = Object.keys(TEAMS).find((k) => same(tokens[k], token || ''));
    return team ? { status: 200, json: teamView(state, team) } : { status: 404, json: { error: 'Enlace no válido' } };
  }

  if (kind === 'b' && same(tokens.banca, token || '')) {
    if (req.method === 'GET' && !action) return { status: 200, json: bankView(state) };
    if (req.method !== 'POST') return { status: 405, json: { error: 'Método no permitido' } };

    const body = req.body || {};
    const team = body.team;
    const entry = (t, before, after, note) => ({ ts: Date.now(), team: t, before, after, note: note || '' });
    const next = { ...state, hist: [...state.hist] };
    const isTeam = Object.prototype.hasOwnProperty.call(TEAMS, team);

    if (action === 'adjust' || action === 'set') {
      const n = action === 'adjust' ? body.delta : body.balance;
      if (!isTeam) return { status: 400, json: { error: 'Equipo no válido' } };
      if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e9) return { status: 400, json: { error: 'Cantidad no válida' } };
      const before = state[team];
      const after = r2(action === 'adjust' ? before + n : n);
      if (after !== before) {
        next[team] = after;
        next.hist.unshift(entry(team, before, after, action === 'set' ? 'fijado' : ''));
      }
    } else if (action === 'undo') {
      const last = next.hist.shift();
      if (!last) return { status: 400, json: { error: 'No hay nada que deshacer' } };
      next[last.team] = last.before;
    } else if (action === 'reset') {
      for (const k of Object.keys(TEAMS)) {
        if (state[k] !== INITIAL) { next.hist.unshift(entry(k, state[k], INITIAL, 'reinicio')); next[k] = INITIAL; }
      }
    } else {
      return { status: 404, json: { error: 'Acción desconocida' } };
    }

    next.hist = next.hist.slice(0, MAX_HIST);
    if (JSON.stringify(next) !== JSON.stringify(state)) {
      next.rev = state.rev + 1;
      await store.set(KEY, next);
      return { status: 200, json: bankView(next) };
    }
    return { status: 200, json: bankView(state) };
  }

  // Cualquier otra cosa (incluido token incorrecto) se responde igual: no se revela nada.
  return { status: 404, json: { error: 'No encontrado' } };
}
