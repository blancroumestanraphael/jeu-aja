// Serveur de développement : sert le jeu (fichiers statiques) ET l'API communautaire sur le même port.
// Usage : npm start  (variables : PORT, AJA_SECRET, AJA_ADMIN_TOKEN, AJA_DB)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from './core.js';
import { fileStorage } from './storage.js';
import { loadServerContent } from './content.js';
import { route } from './router.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const secret = process.env.AJA_SECRET || 'dev-secret-a-changer';
const adminToken = process.env.AJA_ADMIN_TOKEN || 'admin-dev';
if (!process.env.AJA_SECRET) console.warn('⚠ AJA_SECRET non défini : secret de développement utilisé.');
const storage = fileStorage(process.env.AJA_DB || join(ROOT, '.data', 'db.json'));
const api = createService(storage, { secret, adminToken, content: loadServerContent() });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    let body = null;
    if (['POST', 'PUT'].includes(req.method)) {
      const chunks = [];
      let size = 0;
      for await (const c of req) { size += c.length; if (size > 200_000) { res.writeHead(413); return res.end(); } chunks.push(c); }
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const r = await route(api, req.method, url.pathname, body, req.headers, Object.fromEntries(url.searchParams));
    res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(r.json));
  }
  // Fichiers statiques (le dossier .data et server/ ne sont jamais servis)
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  if (/^[/\\](\.data|server|node_modules|\.git)/.test(path)) { res.writeHead(404); return res.end(); }
  const file = join(ROOT, path);
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Introuvable');
  }
}).listen(PORT, () => console.log(`Génération AJA : http://localhost:${PORT}  (admin : /admin.html, jeton « ${adminToken} »)`));
