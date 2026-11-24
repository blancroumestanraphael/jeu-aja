// Fonction Netlify : même API que le serveur de développement, stockage Netlify Blobs.
// Variables d'environnement Netlify : AJA_SECRET (obligatoire), AJA_ADMIN_TOKEN.
import { createService } from '../../server/core.js';
import { blobsStorage } from '../../server/storage.js';
import { loadServerContent } from '../../server/content.js';
import { route } from '../../server/router.js';

let api = null;

export default async (req) => {
  api ||= createService(await blobsStorage(), { secret: process.env.AJA_SECRET, adminToken: process.env.AJA_ADMIN_TOKEN, content: loadServerContent() });
  const url = new URL(req.url);
  let body = null;
  if (['POST', 'PUT'].includes(req.method)) { try { body = await req.json(); } catch { body = {}; } }
  const headers = Object.fromEntries(req.headers);
  const r = await route(api, req.method, url.pathname, body, headers, Object.fromEntries(url.searchParams));
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/*' };
