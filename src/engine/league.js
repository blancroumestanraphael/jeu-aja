// Classement de Ligue 1 simulé.

import { clubTeam, simulateMatch } from './match.js';

export function initTable(clubs) {
  const t = {};
  for (const c of clubs) t[c.id] = { id: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  return t;
}

export function applyResult(table, homeId, awayId, hg, ag) {
  const t = structuredClone(table);
  const h = t[homeId];
  const a = t[awayId];
  h.p++; a.p++;
  h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
  if (hg > ag) { h.w++; a.l++; h.pts += 3; h.form.push('V'); a.form.push('D'); }
  else if (hg < ag) { a.w++; h.l++; a.pts += 3; h.form.push('D'); a.form.push('V'); }
  else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('N'); a.form.push('N'); }
  h.form = h.form.slice(-5);
  a.form = a.form.slice(-5);
  return t;
}

export function sortedTable(table) {
  return Object.values(table).sort(
    (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.id.localeCompare(y.id),
  );
}

/** Simule une journée pour les clubs restants (appariés au hasard, graine). */
export function simulateRound(clubs, excludeIds, rng) {
  const rest = rng.shuffle(clubs.filter((c) => !excludeIds.includes(c.id)));
  const results = [];
  for (let i = 0; i + 1 < rest.length; i += 2) {
    const home = rest[i];
    const away = rest[i + 1];
    const m = simulateMatch(clubTeam(home, { isHome: true }), clubTeam(away), rng);
    results.push({ home: home.id, away: away.id, hg: m.homeGoals, ag: m.awayGoals });
  }
  return results;
}
