// Activités dans les villes de l'Yonne + réputation (fonctions pures : save → nouveau save).

import { addYouth, cityById } from './setup.js';
import { fullName } from './players.js';

export const ACTIVITIES = {
  coach: { label: 'Rencontrer le coach local', rep: 10, icon: '🤝', desc: '+réputation, révèle 1 jeune prometteur' },
  tournoi: { label: 'Tournoi de jeunes', rep: 8, icon: '🏆', desc: 'Révèle 3 jeunes, attributs partiellement cachés' },
  parents: { label: 'Rencontrer les parents', rep: 5, icon: '🏠', desc: 'Dialogue : le jeune rejoint le centre ?' },
  sponsor: { label: 'Négocier un sponsor', rep: 7, icon: '💼', desc: '+budget selon la réputation' },
  gala: { label: 'Match de gala', rep: 15, icon: '🎉', desc: '+réputation forte, coûte 3 000 €', cost: 3000 },
};

export const PARENT_CHOICES = {
  etudes: { label: 'Parler du projet scolaire et de l’internat' },
  temps: { label: 'Promettre du temps de jeu rapidement' },
  club: { label: 'Raconter l’histoire de l’AJA et de ses formés' },
};

export const clampRep = (r) => Math.max(0, Math.min(100, r));

export function addReputation(save, cityId, amount) {
  const c = save.cities[cityId];
  if (c) {
    c.reputation = clampRep(c.reputation + amount);
    c.visitedThisWeek = true;
  }
}

export function canDoActivity(save, cityId, activity) {
  if (save.travelPointsLeft < 1) return { ok: false, reason: 'Plus de points de déplacement cette semaine.' };
  const a = ACTIVITIES[activity];
  if (!a) return { ok: false, reason: 'Activité inconnue.' };
  if (a.cost && save.budget < a.cost) return { ok: false, reason: 'Budget insuffisant.' };
  if (activity === 'parents' && !save.prospects.some((x) => x.cityId === cityId)) {
    return { ok: false, reason: 'Aucun jeune repéré ici : faites d’abord un tournoi ou voyez le coach local.' };
  }
  return { ok: true };
}

function revealProspect(save, data, rng, cityId, { partial }) {
  const rep = save.cities[cityId].reputation;
  const p = addYouth(save, data, rng, {
    age: rng.int(14, 17),
    team: 'PROSPECT',
    cityId,
    potBonus: Math.round((save.facilities.staff - 1) * 2),
    rareAllowed: rep >= 80,
  });
  save.prospects.push({ playerId: p.id, cityId, partial, week: save.week });
  return p;
}

/**
 * Effectue une activité (sauf parents → voir meetParents).
 * Retourne { save, result: { title, lines[], revealed[] } }.
 */
export function doActivity(save0, data, cityId, activity, rng) {
  const check = canDoActivity(save0, cityId, activity);
  if (!check.ok) return { save: save0, result: { error: check.reason } };
  const save = structuredClone(save0);
  const city = cityById(data, cityId);
  const a = ACTIVITIES[activity];
  save.travelPointsLeft--;
  const lines = [];
  const revealed = [];

  if (activity === 'coach') {
    const p = revealProspect(save, data, rng, cityId, { partial: false });
    revealed.push(p.id);
    lines.push(`Le coach de ${city.name} vous parle de ${fullName(p)} (${p.age} ans, ${p.position}).`);
  } else if (activity === 'tournoi') {
    for (let i = 0; i < 3; i++) revealed.push(revealProspect(save, data, rng, cityId, { partial: true }).id);
    lines.push(`Tournoi à ${city.name} : 3 jeunes sortent du lot (attributs partiellement cachés).`);
  } else if (activity === 'sponsor') {
    const def = data.sponsors.sponsors.find((s) => s.city === cityId);
    const st = def && save.sponsors[def.id];
    const rep = save.cities[cityId].reputation;
    const generosity = 0.6 + rep / 100 + (rep >= 50 ? 0.2 : 0);
    if (st && !st.signed) {
      st.signed = true;
      st.budget = Math.round((def.budget * generosity) / 100) * 100;
      st.satisfaction = 60;
      const bonus = Math.round(st.budget * 0.3);
      save.budget += bonus;
      lines.push(`${def.name} signe pour ${st.budget.toLocaleString('fr-FR')} € sur la saison (+${bonus.toLocaleString('fr-FR')} € tout de suite).`);
    } else if (st) {
      const bonus = Math.round((1500 * generosity) / 100) * 100;
      st.satisfaction = Math.min(100, st.satisfaction + 15);
      save.budget += bonus;
      lines.push(`${def.name} est ravi de vous voir : satisfaction +15, prime de ${bonus.toLocaleString('fr-FR')} €.`);
    } else {
      lines.push('Pas de sponsor intéressé ici pour le moment.');
    }
  } else if (activity === 'gala') {
    save.budget -= a.cost;
    lines.push(`Match de gala à ${city.name} : la ville vibre pour l’AJA ! (−${a.cost.toLocaleString('fr-FR')} €)`);
  }

  addReputation(save, cityId, a.rep);
  lines.push(`Réputation à ${city.name} : ${save.cities[cityId].reputation} (+${a.rep}).`);
  save.log.push({ week: save.week, text: `${city.name} — ${a.label}.` });
  return { save, result: { title: a.label, lines, revealed } };
}

/** Rencontre avec les parents d'un jeune repéré. */
export function meetParents(save0, data, prospectId, choice, rng) {
  const check = canDoActivity(save0, save0.prospects.find((x) => x.playerId === prospectId)?.cityId, 'parents');
  if (!check.ok) return { save: save0, result: { error: check.reason } };
  const save = structuredClone(save0);
  const pr = save.prospects.find((x) => x.playerId === prospectId);
  const p = save.players[prospectId];
  const rep = save.cities[pr.cityId].reputation;
  save.travelPointsLeft--;
  const prob = Math.min(0.95, 0.3 + rep / 200 + (save.facilities.internat - 1) * 0.08 + (choice === p.familyPriority ? 0.3 : 0));
  const success = rng.chance(prob);
  const lines = [];
  addReputation(save, pr.cityId, ACTIVITIES.parents.rep);
  if (success) {
    const team = p.age >= 17 ? 'U19' : p.age >= 15 ? 'U17' : 'U15';
    p.team = team;
    save.teams[team].players.push(p.id);
    if (team === 'U19') save.teams.U19.playingTime[p.id] = 'aucun';
    save.prospects = save.prospects.filter((x) => x.playerId !== prospectId);
    lines.push(`Les parents de ${fullName(p)} sont convaincus ! Il rejoint les ${team}.`);
    save.log.push({ week: save.week, text: `${fullName(p)} rejoint le centre (${team}).` });
  } else {
    lines.push(`La famille de ${fullName(p)} hésite encore… Elle semblait surtout attentive à ${hint(p.familyPriority)}.`);
  }
  return { save, result: { title: 'Rencontre avec les parents', lines, success } };
}

function hint(priority) {
  return { etudes: 'la scolarité', temps: 'le temps de jeu', club: 'l’histoire du club' }[priority];
}

/** Fin de semaine : −1 de réputation sans visite. */
export function decayReputation(save) {
  for (const c of Object.values(save.cities)) {
    if (!c.visitedThisWeek) c.reputation = clampRep(c.reputation - 1);
    c.visitedThisWeek = false;
  }
}
