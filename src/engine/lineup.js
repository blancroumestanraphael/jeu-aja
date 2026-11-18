// Formations, composition automatique et force d'équipe pour le moteur de match.

import { overall, groupOf, shortName, POSITION_GROUP } from './players.js';

// x, y en % du terrain (y = 0 en haut = attaque adverse)
export const FORMATIONS = {
  '4-3-3': [
    { pos: 'G', x: 50, y: 92 },
    { pos: 'DG', x: 14, y: 72 }, { pos: 'DC', x: 37, y: 76 }, { pos: 'DC', x: 63, y: 76 }, { pos: 'DD', x: 86, y: 72 },
    { pos: 'MC', x: 25, y: 50 }, { pos: 'MC', x: 50, y: 55 }, { pos: 'MC', x: 75, y: 50 },
    { pos: 'AG', x: 18, y: 22 }, { pos: 'BU', x: 50, y: 15 }, { pos: 'AD', x: 82, y: 22 },
  ],
  '4-4-2': [
    { pos: 'G', x: 50, y: 92 },
    { pos: 'DG', x: 14, y: 72 }, { pos: 'DC', x: 37, y: 76 }, { pos: 'DC', x: 63, y: 76 }, { pos: 'DD', x: 86, y: 72 },
    { pos: 'MG', x: 14, y: 46 }, { pos: 'MC', x: 38, y: 52 }, { pos: 'MC', x: 62, y: 52 }, { pos: 'MD', x: 86, y: 46 },
    { pos: 'BU', x: 36, y: 18 }, { pos: 'BU', x: 64, y: 18 },
  ],
  '3-5-2': [
    { pos: 'G', x: 50, y: 92 },
    { pos: 'DC', x: 25, y: 75 }, { pos: 'DC', x: 50, y: 78 }, { pos: 'DC', x: 75, y: 75 },
    { pos: 'MG', x: 10, y: 46 }, { pos: 'MC', x: 32, y: 50 }, { pos: 'MDC', x: 50, y: 60 }, { pos: 'MC', x: 68, y: 50 }, { pos: 'MD', x: 90, y: 46 },
    { pos: 'BU', x: 36, y: 18 }, { pos: 'BU', x: 64, y: 18 },
  ],
};

const SIMILAR = {
  DG: ['DD'], DD: ['DG'], DC: ['MDC'],
  MDC: ['MC', 'DC'], MC: ['MDC', 'MOC'], MOC: ['MC', 'AG', 'AD'],
  MG: ['AG', 'DG', 'MC'], MD: ['AD', 'DD', 'MC'],
  AG: ['MG', 'AD', 'MOC'], AD: ['MD', 'AG', 'MOC'], BU: ['AG', 'AD', 'MOC'],
};

/** Note effective d'un joueur sur un poste donné. */
export function slotRating(player, slotPos) {
  const ovr = overall(player);
  if (player.position === slotPos) return ovr;
  const pg = groupOf(player);
  const sg = POSITION_GROUP[slotPos];
  if ((pg === 'GK') !== (sg === 'GK')) return ovr - 30;
  if (SIMILAR[slotPos]?.includes(player.position)) return ovr - 2;
  if (pg === sg) return ovr - 4;
  return ovr - 9;
}

/** Composition automatique : 11 titulaires (dans l'ordre des postes de la formation) + remplaçants. */
export function autoLineup(players, formation, benchSize = 7) {
  const slots = FORMATIONS[formation];
  const avail = players.slice();
  const starters = new Array(slots.length).fill(null);
  // Affectation gloutonne globale : meilleurs couples (joueur, poste) d'abord, le poste exact départage.
  const pairs = [];
  for (const p of avail) {
    slots.forEach((s, i) => pairs.push({ p, i, score: slotRating(p, s.pos) + (p.position === s.pos ? 0.5 : 0) }));
  }
  pairs.sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id) || a.i - b.i);
  const used = new Set();
  for (const { p, i } of pairs) {
    if (starters[i] || used.has(p.id)) continue;
    starters[i] = p.id;
    used.add(p.id);
  }
  for (const id of used) avail.splice(avail.findIndex((p) => p.id === id), 1);
  avail.sort((a, b) => overall(b) - overall(a));
  const bench = [];
  const gk = avail.find((p) => groupOf(p) === 'GK');
  if (gk && benchSize > 0) bench.push(gk.id);
  for (const p of avail) {
    if (bench.length >= benchSize) break;
    if (!bench.includes(p.id)) bench.push(p.id);
  }
  return { starters, bench };
}

/** Construit l'objet équipe attendu par le moteur de match. */
export function buildMatchTeam({ id, name, short, players, starters, formation, tactic, isHome }) {
  const slots = FORMATIONS[formation];
  const byId = new Map(players.map((p) => [p.id, p]));
  const xi = starters.map((pid, i) => ({ p: byId.get(pid), slot: slots[i] })).filter((x) => x.p);
  const eff = xi.map(({ p, slot }) => ({ p, r: slotRating(p, slot.pos), g: POSITION_GROUP[slot.pos] }));
  const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 40);
  // Joueurs manquants = trous dans l'équipe
  const missing = 11 - eff.length;
  const rating = (mean(eff.map((e) => e.r)) * eff.length + 30 * missing) / 11;
  return {
    id, name, short, tactic, isHome,
    rating,
    attack: mean(eff.filter((e) => e.g === 'MIL' || e.g === 'ATT').map((e) => e.r)),
    defense: mean(eff.filter((e) => e.g === 'GK' || e.g === 'DEF').map((e) => e.r)),
    morale: mean(eff.map((e) => e.p.morale)),
    players: eff.map((e) => ({ id: e.p.id, name: shortName(e.p), group: e.g })),
  };
}
