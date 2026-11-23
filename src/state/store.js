// État de la partie + sauvegarde (localStorage, et Firestore si Firebase est configuré).

import { newGame, SAVE_VERSION } from '../engine/setup.js';
import { firebaseConfig } from './firebase-config.js';
import { touchDay, isoDay } from '../engine/community.js';
import { ensureContracts } from '../engine/contracts.js';

const LOCAL_KEY = 'generation-aja-save-v' + SAVE_VERSION;

const DATA_FILES = ['players', 'clubs', 'fixtures', 'cities', 'sponsors', 'academy', 'commentary', 'territory', 'heritage'];

export async function loadData() {
  const base = new URL('../data/', import.meta.url);
  const entries = await Promise.all(
    DATA_FILES.map(async (f) => {
      const res = await fetch(new URL(`${f}.json`, base));
      if (!res.ok) throw new Error(`Données introuvables : ${f}.json`);
      return [f, await res.json()];
    }),
  );
  return Object.fromEntries(entries);
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(save) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(save));
  } catch {
    /* stockage indisponible : la partie continue en mémoire */
  }
}

// --- Firebase (optionnel) -------------------------------------------------
let fb = null;
const FB_VERSION = '10.12.2';

async function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) return null;
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    const app = initializeApp(firebaseConfig);
    fb = { app, auth, fs, authInst: auth.getAuth(app), db: fs.getFirestore(app), user: null };
    await new Promise((resolve) => auth.onAuthStateChanged(fb.authInst, (u) => { fb.user = u; resolve(); }));
    return fb;
  } catch (e) {
    console.warn('Firebase indisponible, sauvegarde locale uniquement.', e);
    return null;
  }
}

export async function signInWithGoogle() {
  if (!fb) return null;
  const provider = new fb.auth.GoogleAuthProvider();
  const res = await fb.auth.signInWithPopup(fb.authInst, provider);
  fb.user = res.user;
  return res.user;
}

async function readCloud() {
  if (!fb?.user) return null;
  const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'saves', fb.user.uid));
  return snap.exists() ? JSON.parse(snap.data().json) : null;
}

let cloudTimer = null;
function writeCloud(save) {
  if (!fb?.user) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    fb.fs
      .setDoc(fb.fs.doc(fb.db, 'saves', fb.user.uid), { json: JSON.stringify(save), updatedAt: Date.now(), season: save.season, week: save.week })
      .catch((e) => console.warn('Sauvegarde cloud échouée', e));
  }, 800);
}

// --- Store ---------------------------------------------------------------
export function createStore(data) {
  let save = null;
  const listeners = new Set();
  const store = {
    data,
    get save() { return save; },
    get cloud() { return fb ? { enabled: true, user: fb.user } : { enabled: false }; },
    async init() {
      await initFirebase();
      const cloud = await readCloud().catch(() => null);
      const local = readLocal();
      save = cloud && (!local || cloud.seasonIndex * 100 + cloud.week >= local.seasonIndex * 100 + local.week) ? cloud : local;
      if (save && save.version !== SAVE_VERSION) save = null;
      if (save) ensureContracts(save, data); // anciennes sauvegardes sans contrats
      return !!save;
    },
    newGame(seed) {
      save = touchDay(newGame(data, { seed: seed ?? Math.floor(Math.random() * 1e9), userId: fb?.user?.uid || 'local' }), isoDay());
      store.persist();
    },
    set(next) {
      save = next;
      store.persist();
    },
    /** Petite mutation en place (réglages d'écran). */
    update(fn) {
      fn(save);
      store.persist();
    },
    persist() {
      writeLocal(save);
      writeCloud(save);
      listeners.forEach((l) => l(save));
    },
    reset() {
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* rien */ }
      save = null;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return store;
}
