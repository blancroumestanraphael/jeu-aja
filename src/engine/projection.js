// Projection de l'évolution d'un joueur, avec le même moteur que le jeu (formule de progression + déclin).

import { ATTRS, overall } from './players.js';
import { progressPlayer, ageDecline } from './progression.js';

export const PROJECTION_SEASONS = 4;
const WEEKS = 34;

/** Temps de jeu actuel d'un joueur dans la sauvegarde. */
export function currentPlayingTime(save, p) {
  const A = save.teams.A;
  if (p.team === 'A') return A.starters.includes(p.id) ? 'titulaire' : A.bench.includes(p.id) ? 'remplacant' : 'aucun';
  if (p.team === 'U19') return save.teams.U19.playingTime[p.id] || 'aucun';
  return 'remplacant'; // U17 / U15 simulés, jeunes repérés
}

/**
 * Projette la note sur N saisons en gardant le temps de jeu actuel, les installations actuelles
 * et un entraînement équilibré (axe tournant). Hypothèse : le joueur reste au club.
 * Renvoie [{ season: 1..N, age, ovr }].
 */
export function projectPlayer(player, { facilitiesLevel = 1, playingTime = 'remplacant', seasons = PROJECTION_SEASONS, weeksLeft = WEEKS } = {}) {
  let p = structuredClone(player);
  const out = [];
  for (let s = 1; s <= seasons; s++) {
    const weeks = s === 1 ? weeksLeft : WEEKS;
    for (let w = 0; w < weeks; w++) {
      p.trainingFocus = ATTRS[w % ATTRS.length];
      p = progressPlayer(p, { facilitiesLevel, playingTime });
    }
    p = ageDecline({ ...p, age: p.age + 1 });
    const a = p.attributes;
    out.push({ season: s, age: p.age, ovr: overall(p), ovrExact: (a.technique + a.physique + a.mental + a.vision) / 4 });
  }
  return out;
}

export const SCENARIOS = {
  titulaire: { label: 'Titulaire', playingTime: 'titulaire' },
  remplacant: { label: 'Remplaçant', playingTime: 'remplacant' },
  sansJouer: { label: 'Sans temps de jeu', playingTime: 'aucun' },
};

/**
 * Scénarios de carrière sur 4 saisons selon les choix du joueur (temps de jeu, prêt, staff, installations).
 * Le prêt est modélisé comme une saison de titulaire avec un encadrement moindre (installations niveau 1).
 */
export function careerScenarios(save, p) {
  const weeksLeft = save.seasonOver ? 0 : 35 - save.week;
  const staffExtra = 1 + 0.05 * ((save.staff?.adjoint || 1) - 1);
  const base = { facilitiesLevel: save.facilities.terrains, weeksLeft };
  const run = (opts) => projectPlayerWith(p, { ...base, ...opts, extra: staffExtra });
  const out = Object.entries(SCENARIOS).map(([id, s]) => ({ id, label: s.label, points: run({ playingTime: s.playingTime }) }));
  if (p.age <= 23) out.push({ id: 'pret', label: 'Prêt d’une saison', points: run({ playingTime: 'titulaire', loanSeasons: 1 }) });
  return out;
}

/** Variante de projectPlayer avec bonus de staff et saisons de prêt (encadrement niveau 1, sans bonus staff). */
export function projectPlayerWith(player, { facilitiesLevel = 1, playingTime = 'remplacant', seasons = PROJECTION_SEASONS, weeksLeft = WEEKS, extra = 1, loanSeasons = 0 } = {}) {
  let p = structuredClone(player);
  const out = [];
  for (let s = 1; s <= seasons; s++) {
    const loan = s <= loanSeasons;
    const weeks = s === 1 ? weeksLeft : WEEKS;
    for (let w = 0; w < weeks; w++) {
      p.trainingFocus = ATTRS[w % ATTRS.length];
      p = progressPlayer(p, { facilitiesLevel: loan ? 1 : facilitiesLevel, playingTime, extra: loan ? 1 : extra });
    }
    p = ageDecline({ ...p, age: p.age + 1 });
    const a = p.attributes;
    out.push({ season: s, age: p.age, ovr: overall(p), ovrExact: (a.technique + a.physique + a.mental + a.vision) / 4 });
  }
  return out;
}
