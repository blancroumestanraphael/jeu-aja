// Activités dans les villes de l'Yonne + réputation (fonctions pures : save → nouveau save).

import { addYouth, cityById } from './setup.js';
import { fullName } from './players.js';
import { applyEvent, ensureCommunity, hasPerk } from './community.js';
import { grantCard } from './collection.js';

export const RECRUIT_ACTIVITIES = ['coach', 'tournoi', 'parents'];
export const MISSION_REP = 12;
const yonneIds = (data) => data.cities.cities.map((c) => c.id);
export const missionDone = (save, cityId) => !!save.community?.missionsDone?.[cityId];

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
  if (RECRUIT_ACTIVITIES.includes(activity) && !missionDone(save, cityId)) {
    return { ok: false, reason: 'Accomplissez d\u2019abord la mission de la commune pour gagner la confiance des clubs locaux.' };
  }
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
  const xp = applyEvent(save, 'activity', { cityId, activity });
  return { save, result: { title: a.label, lines, revealed, xp } };
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
  const perk = hasPerk(save, 'ambassadeur') ? 0.05 : 0;
  const prob = Math.min(0.95, 0.3 + rep / 200 + (save.facilities.internat - 1) * 0.08 + perk + (choice === p.familyPriority ? 0.3 : 0));
  const success = rng.chance(prob);
  const lines = [];
  addReputation(save, pr.cityId, ACTIVITIES.parents.rep);
  let xp = applyEvent(save, 'activity', { cityId: pr.cityId, activity: 'parents' });
  if (success) xp += applyEvent(save, 'recruit', { cityId: p.originCity }, yonneIds(data));
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
  return { save, result: { title: 'Rencontre avec les parents', lines, success, xp } };
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

// --- Expérience territoriale --------------------------------------------------

/** Découverte de la commune (gratuite) : présentation + petite XP la première fois. */
export function discoverCity(save0, cityId) {
  const save = structuredClone(save0);
  const xp = applyEvent(save, 'discover', { cityId });
  return { save, xp };
}

/** Mission de la commune : question sur son histoire, puis séance avec le club local. Coûte 1 déplacement. */
export function doMission(save0, data, cityId, choice) {
  if (save0.travelPointsLeft < 1) return { save: save0, result: { error: 'Plus de points de déplacement cette semaine.' } };
  if (missionDone(save0, cityId)) return { save: save0, result: { error: 'Mission déjà accomplie ici.' } };
  const save = structuredClone(save0);
  ensureCommunity(save);
  const city = cityById(data, cityId);
  const m = data.territory.communes[cityId].mission;
  save.travelPointsLeft--;
  const success = choice === m.answer;
  const isHome = save.community.homeCity === cityId;
  const rep = success ? Math.round(MISSION_REP * (isHome ? 1.5 : 1)) : 3;
  addReputation(save, cityId, rep);
  const xp = applyEvent(save, 'mission', { cityId, success, answer: choice });
  const card = success && data.museum ? grantCard(save, data, `com-${cityId}`) : null;
  const lines = success
    ? [`Bonne réponse ! ${m.fact}`, `Les éducateurs de ${city.name} vous ouvrent leurs portes : le recrutement est débloqué ici.`]
    : [`Raté… La bonne réponse était : « ${m.choices[m.answer]} ». ${m.fact}`, 'Revenez une autre fois pour retenter la mission.'];
  lines.push(`Rayonnement de l\u2019AJA à ${city.name} : ${save.cities[cityId].reputation} (+${rep}${isHome ? ', commune de cœur' : ''}).`);
  save.log.push({ week: save.week, text: `${city.name} — mission « ${m.title} » ${success ? 'accomplie' : 'manquée'}.` });
  if (card && !card.duplicate) lines.push(`🃏 Carte « ${card.card.title} » ajoutée à votre collection.`);
  return { save, result: { title: m.title, lines, success, xp, card } };
}

/** Mission partenaire (partenaire signé) : découvrir son activité. Coûte 1 déplacement. */
export function partnerMission(save0, data, sponsorId) {
  const def = data.sponsors.sponsors.find((x) => x.id === sponsorId);
  const st = save0.sponsors[sponsorId];
  if (!def || !st?.signed) return { save: save0, result: { error: 'Ce commerce n\u2019est pas encore partenaire.' } };
  if (save0.travelPointsLeft < 1) return { save: save0, result: { error: 'Plus de points de déplacement cette semaine.' } };
  if (save0.community?.partnersMet?.includes(sponsorId)) return { save: save0, result: { error: 'Partenaire déjà découvert.' } };
  const save = structuredClone(save0);
  save.travelPointsLeft--;
  save.sponsors[sponsorId].satisfaction = Math.min(100, st.satisfaction + 10);
  addReputation(save, def.city, 4);
  const xp = applyEvent(save, 'partner', { sponsorId, xp: def.rewardInGame?.xp });
  return { save, result: { title: def.name, lines: [def.discovery, `Satisfaction du partenaire +10.`], xp } };
}

/** Visite d'un lieu emblématique de l'AJA (à Auxerre : gratuit). */
export function visitLandmark(save0, landmarkId) {
  const save = structuredClone(save0);
  const xp = applyEvent(save, 'landmark', { id: landmarkId });
  return { save, xp };
}
