// Progression hebdomadaire : Δ = 0,4 × (P − A)/P × f_entraînement × f_installations × f_tempsDeJeu × f_âge

import { ATTRS } from './players.js';

export const K_PROGRESSION = 0.4;

export const fTraining = (attr, focus) => (attr === focus ? 1.5 : 0.8);
export const fFacilities = (level) => 1 + 0.1 * Math.max(0, level - 1);
export const fPlayingTime = (time) => ({ aucun: 0.7, remplacant: 1.0, titulaire: 1.3 }[time] ?? 0.7);
export const fAge = (age) => (age < 18 ? 1.3 : age <= 21 ? 1.0 : 0.6);

export function attributeDelta({ potential, value, attr, focus, facilitiesLevel, playingTime, age, extra = 1 }) {
  if (value >= potential) return 0;
  return (
    K_PROGRESSION *
    ((potential - value) / potential) *
    fTraining(attr, focus) *
    fFacilities(facilitiesLevel) *
    fPlayingTime(playingTime) *
    fAge(age) *
    extra
  );
}

/** Renvoie un nouveau joueur après une semaine d'entraînement. */
export function progressPlayer(player, { facilitiesLevel = 1, playingTime = 'aucun', extra = 1 } = {}) {
  const attributes = { ...player.attributes };
  for (const attr of ATTRS) {
    const d = attributeDelta({
      potential: player.potential,
      value: attributes[attr],
      attr,
      focus: player.trainingFocus,
      facilitiesLevel,
      playingTime,
      age: player.age,
      extra,
    });
    // Ne jamais raboter un attribut déjà au-dessus du potentiel (cas des pros) : on plafonne seulement la hausse.
    if (d > 0) attributes[attr] = Math.min(player.potential, Math.round((attributes[attr] + d) * 100) / 100);
  }
  return { ...player, attributes };
}

/** Déclin lié à l'âge, appliqué à chaque nouvelle saison (31-32 ans : −1 par attribut, 33 ans et plus : −2). */
export function ageDecline(player) {
  const d = player.age >= 33 ? 2 : player.age >= 31 ? 1 : 0;
  if (!d) return player;
  const attributes = {};
  for (const k of ATTRS) attributes[k] = Math.max(30, player.attributes[k] - d);
  return { ...player, attributes };
}
