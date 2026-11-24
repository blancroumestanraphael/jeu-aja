// Client de l'API communautaire : compte, envoi de la file d'actions, classements, défis, groupes.
// Hors ligne ou sans serveur : le jeu reste jouable, les actions attendent dans la sauvegarde.
import { backendConfig } from './backend-config.js';
import { setErrorSink } from './telemetry.js';

const ACCOUNT_KEY = 'generation-aja-account';
let status = { checked: false, online: false };

export const account = () => { try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch { return null; } };
const saveAccount = (a) => { try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a)); } catch { /* rien */ } };
export const forgetAccount = () => { try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* rien */ } };

async function call(method, path, body, { auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const a = account();
    if (!a) throw new Error('Pas de compte supporter.');
    headers.Authorization = `Bearer ${a.token}`;
  }
  const res = await fetch(`${backendConfig.baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status });
  return json;
}

export async function checkServer(force = false) {
  if (status.checked && !force) return status.online;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${backendConfig.baseUrl}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    status = { checked: true, online: res.ok };
  } catch {
    status = { checked: true, online: false };
  }
  if (status.online) {
    setErrorSink((e) => { call('POST', '/errors', e).catch(() => {}); });
  }
  return status.online;
}
export const serverStatus = () => status;

export async function register(profile) {
  const r = await call('POST', '/register', profile);
  saveAccount({ userId: r.userId, token: r.token });
  return r.profile;
}
export const updateProfile = (p) => call('PUT', '/me', p, { auth: true });
export const me = () => call('GET', '/me', null, { auth: true });
export const publicProfile = (id) => call('GET', `/profile/${encodeURIComponent(id)}`);
export const leaderboard = (kind) => call('GET', `/leaderboard/${kind}?limit=50${account() ? `&me=${account().userId}` : ''}`);
export const events = () => call('GET', '/events');
export const campaigns = () => call('GET', '/campaigns');
export const createGroup = (name, description) => call('POST', '/groups', { name, description }, { auth: true });
export const joinGroup = (code) => call('POST', '/groups/join', { code }, { auth: true });
export const leaveGroup = () => call('POST', '/groups/leave', {}, { auth: true });
export const group = (id) => call('GET', `/groups/${encodeURIComponent(id)}`, null, { auth: !!account() });

let inflight = null;
/** Envoie la file d'actions de la sauvegarde. Renvoie { sent, gained } ou null. Un appel pendant un envoi attend ce dernier. */
export function flush(store) {
  if (inflight) return inflight.then(() => flushNow(store));
  return flushNow(store);
}
async function flushNow(store) {
  if (inflight) return inflight;
  if (!account() || !store.save?.sync?.pending?.length) return null;
  inflight = doFlush(store).finally(() => { inflight = null; });
  return inflight;
}
async function doFlush(store) {
  if (!(await checkServer())) return null;
  try {
    let sent = 0;
    let gained = 0;
    while (store.save.sync.pending.length) {
      const batch = store.save.sync.pending.slice(0, 100);
      const r = await call('POST', '/actions', { actions: batch }, { auth: true });
      const done = new Set([...r.accepted, ...r.rejected.map((x) => x.clientId)]);
      store.update((s) => {
        s.sync.pending = s.sync.pending.filter((a) => !done.has(a.clientId));
        s.sync.lastSync = new Date().toISOString();
        s.sync.profile = r.profile;
      });
      sent += batch.length;
      gained += r.gained;
      if (!done.size) break;
    }
    return { sent, gained };
  } catch (e) {
    if (e.status === 401) forgetAccount();
    return null;
  }
}

/** Synchronisation automatique : démarrage, retour en ligne, et après chaque modification (différée). */
export function startAutoSync(store) {
  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => flush(store), 4000); };
  store.subscribe(later);
  window.addEventListener('online', () => { status.checked = false; flush(store); });
  checkServer().then(() => flush(store));
}
