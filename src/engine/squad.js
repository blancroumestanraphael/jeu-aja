// Vestiaire et terrain : disponibilité (blessures, suspensions, prêts), cohésion, plan de jeu, staff, notes de match.

import { overall, fullName } from './players.js';
import { FORMATIONS, slotRating, autoLineup } from './lineup.js';

// --- Plan de jeu contre l'adversaire ---------------------------------------------
export const PLANS = {
  possession: { label: 'Possession', desc: 'Confisquer le ballon, user l’adversaire.', beats: 'contre' },
  pressing: { label: 'Pressing', desc: 'Harceler haut, récupérer vite.', beats: 'possession' },
  contre: { label: 'Contre-attaque', desc: 'Bloc compact, transitions rapides.', beats: 'pressing' },
};
/** Bonus (ou malus) de force selon le plan choisi face au style adverse ; l'analyste vidéo l'amplifie. */
export function planFactor(plan, oppStyle, analystLevel = 1) {
  if (!PLANS[plan] || !PLANS[oppStyle] || plan === oppStyle) return 1;
  const amp = 0.03 + 0.01 * (analystLevel - 1);
  if (PLANS[plan].beats === oppStyle) return 1 + amp;
  if (PLANS[oppStyle].beats === plan) return 1 - amp;
  return 1;
}
/** L'analyste vidéo (niveau 2+) révèle le style du prochain adversaire. */
export const styleKnown = (save) => (save.staff?.analyste || 1) >= 2;

// --- Cohésion --------------------------------------------------------------------
export const cohesionFactor = (c) => 0.95 + 0.1 * ((c ?? 60) / 100);
/** Un XI stable soude le groupe ; beaucoup de changements le désorganisent. */
export function updateCohesion(cohesion, prevStarters, starters) {
  if (!prevStarters?.length) return cohesion;
  const changes = starters.filter((id) => !prevStarters.includes(id)).length;
  return Math.max(0, Math.min(100, cohesion + 3 - 2 * changes));
}

// --- Staff technique ---------------------------------------------------------------
export const STAFF = {
  adjoint: { label: 'Entraîneur adjoint', effect: '+5 % de progression par niveau (équipe 1 et U19)' },
  physique: { label: 'Préparateur physique', effect: '−15 % de blessures par niveau' },
  analyste: { label: 'Analyste vidéo', effect: 'Révèle le style adverse (niv. 2) et renforce le plan de jeu' },
};
export const staffCost = (lvl) => 6000 * lvl;
export const progressionStaffFactor = (save) => 1 + 0.05 * ((save.staff?.adjoint || 1) - 1);

// --- Disponibilité ------------------------------------------------------------------
export const isAvailable = (p) => !p.injury && !(p.suspension > 0);
export function unavailableReason(p) {
  if (p.injury) return `blessé (${p.injury.label}, ${p.injury.weeks} sem.)`;
  if (p.suspension > 0) return `suspendu (${p.suspension} match${p.suspension > 1 ? 's' : ''})`;
  return null;
}

/** Remplace les titulaires indisponibles par le meilleur joueur disponible pour le poste ; nettoie le banc. */
export function ensureAvailableLineup(save) {
  const A = save.teams.A;
  const slots = FORMATIONS[A.formation];
  const P = (id) => save.players[id];
  const changes = [];
  A.starters = A.starters.map((id, i) => {
    if (id && isAvailable(P(id))) return id;
    const used = new Set(A.starters.filter(Boolean));
    const candidates = A.players.filter((x) => !used.has(x) && isAvailable(P(x)));
    if (!candidates.length) return id;
    const best = candidates.reduce((b, x) => (slotRating(P(x), slots[i].pos) > slotRating(P(b), slots[i].pos) ? x : b));
    if (id) changes.push({ out: P(id), in: P(best) });
    return best;
  });
  A.bench = A.bench.filter((id) => !A.starters.includes(id) && isAvailable(P(id)));
  const rest = A.players.filter((id) => !A.starters.includes(id) && !A.bench.includes(id) && isAvailable(P(id)))
    .sort((a, b) => overall(P(b)) - overall(P(a)));
  while (A.bench.length < 7 && rest.length) A.bench.push(rest.shift());
  return changes;
}

const INJURIES = [
  { label: 'contracture', min: 1, max: 2 }, { label: 'entorse de la cheville', min: 2, max: 4 },
  { label: 'élongation', min: 2, max: 3 }, { label: 'déchirure musculaire', min: 3, max: 6 }, { label: 'choc au genou', min: 1, max: 3 },
];
export const INJURY_P = 0.018;

/** Après un match : blessures (titulaires), cartons. Renvoie des lignes de bilan. */
export function applyMatchConsequences(save, starterIds, events, side, rng) {
  const lines = [];
  const physique = save.staff?.physique || 1;
  const pInj = INJURY_P * (1 - 0.15 * (physique - 1));
  for (const id of starterIds) {
    const p = save.players[id];
    if (rng.chance(pInj)) {
      const t = rng.pick(INJURIES);
      p.injury = { label: t.label, weeks: rng.int(t.min, t.max) };
      lines.push(`🚑 ${fullName(p)} : ${t.label}, absent ${p.injury.weeks} semaine(s).`);
    }
  }
  for (const ev of events) {
    if (ev.side !== side || !ev.playerId || !save.players[ev.playerId]) continue;
    const p = save.players[ev.playerId];
    if (ev.type === 'red') {
      p.suspension = (p.suspension || 0) + 1;
      lines.push(`🟥 ${fullName(p)} expulsé : suspendu 1 match.`);
    } else if (ev.type === 'card') {
      p.yellow = (p.yellow || 0) + 1;
      if (p.yellow >= 5) {
        p.yellow = 0;
        p.suspension = (p.suspension || 0) + 1;
        lines.push(`🟨 ${fullName(p)} atteint 5 avertissements : suspendu 1 match.`);
      }
    }
  }
  return lines;
}

/** Début de semaine suivante : les blessures guérissent, les suspensions purgées diminuent. */
export function tickAvailability(save, servedIds) {
  for (const p of Object.values(save.players)) {
    if (p.injury) {
      p.injury.weeks -= 1;
      if (p.injury.weeks <= 0) p.injury = null;
    }
  }
  for (const id of servedIds) {
    const p = save.players[id];
    if (p?.suspension > 0) p.suspension -= 1;
  }
}

// --- Notes de match -----------------------------------------------------------------
/** Note sur 10 de chaque titulaire, statistiques cumulées dans p.matchStats. */
export function rateStarters(save, starterIds, events, side, outcome, rng, slots = null) {
  const goals = {};
  for (const ev of events) if (ev.type === 'goal' && ev.side === side && ev.playerId) goals[ev.playerId] = (goals[ev.playerId] || 0) + 1;
  const ratings = {};
  starterIds.forEach((id, i) => {
    const p = save.players[id];
    if (!p) return;
    const lvl = slots ? slotRating(p, slots[i].pos) : overall(p);
    let r = 6 + (outcome === 'V' ? 0.5 : outcome === 'D' ? -0.4 : 0) + (goals[id] || 0) * 1 + (lvl - 70) / 20 + rng.range(-0.8, 0.8);
    r = Math.round(Math.max(3, Math.min(10, r)) * 10) / 10;
    ratings[id] = r;
    p.matchStats ||= { apps: 0, goals: 0, ratingSum: 0 };
    p.matchStats.apps += 1;
    p.matchStats.goals += goals[id] || 0;
    p.matchStats.ratingSum += r;
  });
  return ratings;
}
export const avgRating = (p) => (p.matchStats?.apps ? Math.round((p.matchStats.ratingSum / p.matchStats.apps) * 10) / 10 : null);
