// Routes HTTP de l'API (communes au serveur de développement et à la fonction Netlify).
export async function route(api, method, path, body, headers, query = {}) {
  const p = path.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
  const seg = p.split('/').filter(Boolean);
  const is = (m, ...parts) => method === m && seg.length === parts.length && parts.every((x, i) => x === '*' || x === seg[i]);
  try {
    if (is('GET', 'health')) return ok(await api.health());
    if (is('POST', 'register')) return ok(await api.register(body));
    if (is('GET', 'me')) return ok(await api.me(headers));
    if (is('PUT', 'me')) return ok(await api.updateProfile(headers, body));
    if (is('POST', 'actions')) return ok(await api.submitActions(headers, body));
    if (is('GET', 'profile', '*')) return ok(await api.profile(seg[1]));
    if (is('GET', 'leaderboard', '*')) return ok(await api.leaderboard(seg[1], { meId: query.me || null, limit: Math.min(100, Number(query.limit) || 50) }));
    if (is('GET', 'events')) return ok(await api.events());
    if (is('GET', 'campaigns')) return ok(await api.campaigns());
    if (is('POST', 'groups')) return ok(await api.createGroup(headers, body));
    if (is('POST', 'groups', 'join')) return ok(await api.joinGroup(headers, body));
    if (is('POST', 'groups', 'leave')) return ok(await api.leaveGroup(headers));
    if (is('GET', 'groups', '*')) return ok(await api.group(seg[1], headers));
    if (is('POST', 'errors')) return ok(await api.reportError(body));
    if (is('GET', 'admin', 'stats')) return ok(await api.adminStats(headers));
    if (is('POST', 'admin', 'events')) return ok(await api.adminSaveEvent(headers, body));
    if (is('DELETE', 'admin', 'events', '*')) return ok(await api.adminDeleteEvent(headers, seg[2]));
    if (is('GET', 'admin', 'campaigns')) return ok(await api.adminPartners(headers));
    if (is('POST', 'admin', 'campaigns')) return ok(await api.adminSaveCampaign(headers, body));
    return { status: 404, json: { error: 'Route inconnue.' } };
  } catch (e) {
    if (!e.status) console.error(e);
    return { status: e.status || 500, json: { error: e.status ? e.message : 'Erreur serveur.' } };
  }
}
const ok = (json) => ({ status: 200, json });
