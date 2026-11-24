// Création d'une nouvelle partie (pure : data + graine → save).

import { createRng, hashSeed } from './rng.js';
import { fromRealPlayer, generateYouth } from './players.js';
import { autoLineup } from './lineup.js';
import { initTable } from './league.js';

import { SAVE_VERSION, migrateSave } from './migrations.js';
export { SAVE_VERSION };

export function cityById(data, id) {
  return data.cities.cities.find((c) => c.id === id) || data.academy.otherCities.find((c) => c.id === id) || null;
}

/** Génère un jeune et l'ajoute à la sauvegarde (mutation locale d'un save déjà cloné). */
export function addYouth(save, data, rng, { age, team, cityId, potBonus = 0, rareAllowed = false, group, noticeWeek }) {
  const city = cityId ? cityById(data, cityId) : null;
  const rep = city && save.cities[city.id] ? save.cities[city.id].reputation : 20;
  const id = `y_${save.nextId++}`;
  const p = generateYouth(rng, { id, age, team, city, reputation: rep, names: data.academy, potBonus, rareAllowed, group });
  if (noticeWeek != null) p.noticeWeek = noticeWeek;
  save.players[id] = p;
  if (save.teams[team]) save.teams[team].players.push(id);
  return p;
}

function randomOriginCity(rng, data) {
  // 75 % des jeunes viennent de l'Yonne
  if (rng.chance(0.75)) return rng.pick(data.cities.cities).id;
  return rng.pick(data.academy.otherCities).id;
}

export function newGame(data, { seed = (Date.now() % 1e9) | 0, userId = 'local' } = {}) {
  const rng = createRng(hashSeed(seed, 'setup'));
  const save = {
    version: SAVE_VERSION,
    userId,
    season: data.fixtures.season,
    seasonIndex: 0,
    week: 1,
    budget: 20000,
    facilities: { terrains: 1, internat: 1, staff: 1 },
    travelPointsLeft: 2,
    goldenBook: [],
    seed,
    nextId: 1,
    players: {},
    teams: {
      A: { players: [], formation: '4-3-3', tactic: 'equilibre', starters: [], bench: [] },
      U19: { players: [], formation: '4-3-3', tactic: 'equilibre', playingTime: {} },
      U17: { players: [] },
      U15: { players: [] },
    },
    coaches: Object.fromEntries(data.academy.coaches.map((c) => [c.id, { ...c }])),
    cities: Object.fromEntries(data.cities.cities.map((c) => [c.id, { reputation: c.reputation, visitedThisWeek: false }])),
    sponsors: Object.fromEntries(
      data.sponsors.sponsors.map((s) => [s.id, { signed: s.id === 's_garage', satisfaction: s.satisfaction, budget: s.budget }]),
    ),
    messages: [],
    table: initTable(data.clubs.clubs),
    results: [],
    log: [{ week: 1, text: 'Bienvenue à l’AJ Auxerre ! Saison 2026-27, coach : ' + data.players.coach + '.' }],
    prospects: [],
    proposedIds: [],
    keyResults: {},
    lastReport: null,
    seasonOver: false,
    settings: { demoKeyMatch: true },
    onboarding: { done: false, step: 0 },
  };

  // Équipe 1 : vrais joueurs (EA FC 27)
  for (const r of data.players.players) {
    const p = fromRealPlayer(r);
    save.players[p.id] = p;
    save.teams.A.players.push(p.id);
  }
  const A = save.teams.A;
  Object.assign(A, autoLineup(A.players.map((id) => save.players[id]), A.formation));

  // U19 : 22 jeunes (2 gardiens), 16-18 ans
  const u19Groups = ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'MIL', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT', 'ATT', 'ATT', 'MIL'];
  u19Groups.forEach((group, i) => {
    addYouth(save, data, rng, { age: 16 + (i % 3), team: 'U19', cityId: randomOriginCity(rng, data), group, potBonus: i === 5 || i === 12 ? 8 : 0 });
  });
  const U19 = save.teams.U19;
  const { starters, bench } = autoLineup(U19.players.map((id) => save.players[id]), U19.formation, 5);
  for (const id of U19.players) U19.playingTime[id] = starters.includes(id) ? 'titulaire' : bench.includes(id) ? 'remplacant' : 'aucun';

  // U17 / U15 (simulés), quelques pépites repérées plus tard par les coachs
  for (const [team, ages] of [['U17', [15, 16]], ['U15', [13, 14]]]) {
    for (let i = 0; i < 14; i++) {
      const star = i < 4;
      addYouth(save, data, rng, {
        age: ages[i % 2],
        team,
        cityId: randomOriginCity(rng, data),
        potBonus: star ? rng.int(8, 14) : 0,
        noticeWeek: star ? rng.int(2, 30) : 99,
      });
    }
  }
  return migrateSave(save, data).save; // ajoute les champs des versions récentes
}
