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
