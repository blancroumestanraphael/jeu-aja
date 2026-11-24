// Adaptateurs de stockage clé-valeur JSON : { get, set, list }.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

/** Mémoire (tests). */
export function memoryStorage() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

/** Fichier JSON unique (serveur de développement). Écriture atomique, différée. */
export function fileStorage(path) {
  const m = new Map(existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8'))) : []);
  let timer = null;
  const flush = () => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, JSON.stringify(Object.fromEntries(m)));
    renameSync(`${path}.tmp`, path);
  };
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); clearTimeout(timer); timer = setTimeout(flush, 200); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    flush,
  };
}

/** Netlify Blobs (production prototype). Pour l'exploitation : Firestore avec transactions (voir docs/architecture.md). */
export async function blobsStorage(name = 'generation-aja') {
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name, consistency: 'strong' });
  return {
    async get(k) { return store.get(k, { type: 'json' }); },
    async set(k, v) { await store.setJSON(k, v); },
    async list(prefix) { return (await store.list({ prefix })).blobs.map((b) => b.key); },
  };
}
