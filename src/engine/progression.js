// Progression hebdomadaire : Δ = 0,4 × (P − A)/P × f_entraînement × f_installations × f_tempsDeJeu × f_âge

import { ATTRS } from './players.js';

export const K_PROGRESSION = 0.4;

export const fTraining = (attr, focus) => (attr === focus ? 1.5 : 0.8);
export const fFacilities = (level) => 1 + 0.1 * Math.max(0, level - 1);
export const fPlayingTime = (time) => ({ aucun: 0.7, remplacant: 1.0, titulaire: 1.3 }[time] ?? 0.7);
export const fAge = (age) => (age < 18 ? 1.3 : age <= 21 ? 1.0 : 0.6);

export function attributeDelta({ potential, value, attr, focus, facilitiesLevel, playingTime, age }) {
  if (value >= potential) return 0;
  return (
    K_PROGRESSION *
    ((potential - value) / potential) *
    fTraining(attr, focus) *
    fFacilities(facilitiesLevel) *
    fPlayingTime(playingTime) *
    fAge(age)
  );
}

/** Renvoie un nouveau joueur après une semaine d'entraînement. */
export function progressPlayer(player, { facilitiesLevel = 1, playingTime = 'aucun' } = {}) {
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
    });
    attributes[attr] = Math.min(player.potential, Math.round((attributes[attr] + d) * 100) / 100);
  }
  return { ...player, attributes };
}
