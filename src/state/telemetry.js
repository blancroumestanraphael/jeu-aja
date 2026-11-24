// Suivi des erreurs : conservées localement (30 dernières) et envoyées au serveur quand il est disponible.
const KEY = 'generation-aja-errors';
let sink = null;

export function readErrors() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function record(entry) {
  const list = readErrors();
  list.push(entry);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-30))); } catch { /* rien */ }
  sink?.(entry);
}

export function initErrorTracking(version) {
  window.addEventListener('error', (e) => record({ at: new Date().toISOString(), version, msg: String(e.message), src: `${e.filename}:${e.lineno}`, route: location.hash }));
  window.addEventListener('unhandledrejection', (e) => record({ at: new Date().toISOString(), version, msg: String(e.reason?.message || e.reason), route: location.hash }));
}

/** Branche l'envoi au serveur (phase communauté). */
export function setErrorSink(fn) { sink = fn; }
export function clearErrors() { try { localStorage.removeItem(KEY); } catch { /* rien */ } }
