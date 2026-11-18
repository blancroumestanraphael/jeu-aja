// Boucle hebdomadaire : « Semaine suivante » → matchs, progression, messages, bilan.

import { streamFor } from './rng.js';
import { ATTRS, overall, fullName, groupOf } from './players.js';
import { autoLineup, buildMatchTeam } from './lineup.js';
import { simulateMatch, clubTeam } from './match.js';
import { applyResult, simulateRound, sortedTable } from './league.js';
import { progressPlayer } from './progression.js';
import { checkCoachMessages, resolveRivalRisk, surpriseEvent, removeFromTeams } from './events.js';
import { decayReputation } from './activities.js';
import { addYouth } from './setup.js';

export const SEASON_WEEKS = 34;
export const TRAVEL_POINTS = 2;

export const fixtureOfWeek = (data, week) => data.fixtures.fixtures.find((f) => f.week === week);
export const clubById = (data, id) => data.clubs.clubs.find((c) => c.id === id);
export const u19OpponentOfWeek = (data, week) => {
  const list = data.academy.u19Opponents;
  return { ...list[(week - 1) % list.length], home: week % 2 === 1 };
};

/** Complète les trous de la composition de l'équipe 1. */
export function ensureFirstTeamLineup(save) {
  const A = save.teams.A;
  const players = A.players.map((id) => save.players[id]);
  const valid = A.starters && A.starters.length === 11 && A.starters.every((id) => id && A.players.includes(id));
  if (!valid) {
    const keep = (A.starters || []).filter((id) => id && A.players.includes(id));
    if (keep.length === 0 || (A.starters || []).length !== 11) {
      Object.assign(A, autoLineup(players, A.formation));
    } else {
      const rest = players.filter((p) => !keep.includes(p.id));
      const fill = autoLineup(rest, A.formation);
      A.starters = A.starters.map((id, i) => (id && A.players.includes(id) ? id : fill.starters[i]));
      A.bench = (A.bench || []).filter((id) => A.players.includes(id) && !A.starters.includes(id));
    }
  }
  A.bench = (A.bench || []).filter((id) => !A.starters.includes(id)).slice(0, 7);
}

export function firstTeamMatchTeam(save, data, isHome) {
  ensureFirstTeamLineup(save);
  const A = save.teams.A;
  const aux = clubById(data, 'auxerre');
  return buildMatchTeam({
    id: 'auxerre', name: aux.name, short: aux.short,
    players: A.players.map((id) => save.players[id]),
    starters: A.starters, formation: A.formation, tactic: A.tactic, isHome,
  });
}

export function u19MatchTeam(save, isHome) {
  const U19 = save.teams.U19;
  const all = U19.players.map((id) => save.players[id]);
  let tit = all.filter((p) => U19.playingTime[p.id] === 'titulaire');
  if (tit.length < 11) {
    const others = all.filter((p) => !tit.includes(p)).sort((a, b) => overall(b) - overall(a));
    tit = tit.concat(others.slice(0, 11 - tit.length));
  }
  if (tit.length > 11) tit = tit.sort((a, b) => overall(b) - overall(a)).slice(0, 11);
  const { starters } = autoLineup(tit, U19.formation, 0);
  return {
    team: buildMatchTeam({ id: 'u19', name: 'AJA U19', short: 'AJA U19', players: tit, starters, formation: U19.formation, tactic: U19.tactic, isHome }),
    starterIds: tit.map((p) => p.id),
  };
}

const clampM = (m) => Math.max(10, Math.min(100, m));

export function advanceWeek(save0, data) {
  const save = structuredClone(save0);
  if (save.seasonOver) return { save: save0, report: null };
  const week = save.week;
  const fixture = fixtureOfWeek(data, week);
  const report = { week, season: save.season, progress: [], newMessages: [], lines: [] };

  // --- Équipe 1 (Ligue 1)
  const club = clubById(data, fixture.opponent);
  const aja = firstTeamMatchTeam(save, data, fixture.home);
  const opp = clubTeam(club, { isHome: !fixture.home });
  const home = fixture.home ? aja : opp;
  const away = fixture.home ? opp : aja;
  let l1;
  const key = save.keyResults[week];
  if (key) {
    l1 = { homeGoals: key.homeGoals, awayGoals: key.awayGoals, events: key.events, fromKeyMatch: true };
  } else {
    l1 = simulateMatch(home, away, streamFor(save, 'l1'), { templates: data.commentary, stadium: fixture.home ? clubById(data, 'auxerre').stadium : club.stadium });
  }
  save.table = applyResult(save.table, home.id, away.id, l1.homeGoals, l1.awayGoals);
  for (const r of simulateRound(data.clubs.clubs, ['auxerre', club.id], streamFor(save, 'round'))) {
    save.table = applyResult(save.table, r.home, r.away, r.hg, r.ag);
  }
  const ajaGoals = fixture.home ? l1.homeGoals : l1.awayGoals;
  const oppGoals = fixture.home ? l1.awayGoals : l1.homeGoals;
  const l1Outcome = ajaGoals > oppGoals ? 'V' : ajaGoals < oppGoals ? 'D' : 'N';
  save.results.push({ week, comp: 'L1', home: home.name, away: away.name, hg: l1.homeGoals, ag: l1.awayGoals, outcome: l1Outcome });
  report.l1 = { home: home.name, away: away.name, hg: l1.homeGoals, ag: l1.awayGoals, events: l1.events, outcome: l1Outcome, fromKeyMatch: !!l1.fromKeyMatch };

  // --- U19
  const u19Opp = u19OpponentOfWeek(data, week);
  const { team: u19, starterIds: u19Starters } = u19MatchTeam(save, u19Opp.home);
  const oppU19 = { id: 'u19opp', name: u19Opp.name, short: u19Opp.name, rating: u19Opp.level, attack: u19Opp.level, defense: u19Opp.level, morale: 70, tactic: 'equilibre', isHome: !u19Opp.home, players: [] };
  const uh = u19Opp.home ? u19 : oppU19;
  const ua = u19Opp.home ? oppU19 : u19;
  const um = simulateMatch(uh, ua, streamFor(save, 'u19'), { templates: data.commentary, stadium: u19Opp.home ? 'à Auxerre' : 'à l\u2019extérieur' });
  const uG = u19Opp.home ? um.homeGoals : um.awayGoals;
  const uO = u19Opp.home ? um.awayGoals : um.homeGoals;
  const u19Outcome = uG > uO ? 'V' : uG < uO ? 'D' : 'N';
  save.results.push({ week, comp: 'U19', home: uh.name, away: ua.name, hg: um.homeGoals, ag: um.awayGoals, outcome: u19Outcome });
  report.u19 = { home: uh.name, away: ua.name, hg: um.homeGoals, ag: um.awayGoals, outcome: u19Outcome, scorers: um.events.filter((e) => e.type === 'goal' && e.side === (u19Opp.home ? 'home' : 'away')).map((e) => e.playerId) };

  // --- Temps de jeu, moral, minutes
  const A = save.teams.A;
  const ptA = (id) => (A.starters.includes(id) ? 'titulaire' : A.bench.includes(id) ? 'remplacant' : 'aucun');
  const startersAvg = A.starters.reduce((s, id) => s + overall(save.players[id]), 0) / 11;
  const moraleDelta = { V: 4, N: 0, D: -4 };
  for (const id of A.players) {
    const p = save.players[id];
    const pt = ptA(id);
    if (pt === 'titulaire') p.minutesThisSeason += 90;
    if (pt === 'remplacant') p.minutesThisSeason += 15;
    if (pt !== 'aucun') p.morale = clampM(p.morale + moraleDelta[l1Outcome]);
    else p.morale = clampM(p.morale - 1);
    // Jeune monté trop tôt : −5 de moral par match joué
    if (!p.isReal && pt !== 'aucun' && overall(p) < startersAvg - 10) {
      p.morale = clampM(p.morale - 5);
      report.lines.push(`${fullName(p)} souffre en équipe 1 (moral −5).`);
    }
  }
  for (const id of save.teams.U19.players) {
    const p = save.players[id];
    const played = u19Starters.includes(id);
    const pt = save.teams.U19.playingTime[id] || 'aucun';
    if (played) p.minutesThisSeason += 90;
    else if (pt === 'remplacant') p.minutesThisSeason += 20;
    p.morale = clampM(p.morale + (played ? 1 + moraleDelta[u19Outcome] / 2 : pt === 'remplacant' ? 0 : -2));
  }

  // --- Progression
  const lvl = save.facilities.terrains;
  const track = (p) => {
    const before = overall(p);
    return () => {
      const after = overall(save.players[p.id]);
      save.players[p.id].history = [...(save.players[p.id].history || []), [save.seasonIndex * 100 + week, after]].slice(-80);
      if (after !== before && !p.isReal) report.progress.push({ id: p.id, name: fullName(p), from: before, to: after, team: p.team });
    };
  };
  for (const id of A.players) {
    const done = track(save.players[id]);
    save.players[id] = progressPlayer(save.players[id], { facilitiesLevel: lvl, playingTime: ptA(id) });
    done();
  }
  for (const id of save.teams.U19.players) {
    const done = track(save.players[id]);
    const pt = u19Starters.includes(id) ? 'titulaire' : save.teams.U19.playingTime[id] === 'remplacant' ? 'remplacant' : 'aucun';
    save.players[id] = progressPlayer(save.players[id], { facilitiesLevel: lvl, playingTime: pt });
    done();
  }
  for (const team of ['U17', 'U15']) {
    save.teams[team].players.forEach((id, i) => {
      const p = save.players[id];
      p.trainingFocus = ATTRS[(week + i) % 4];
      save.players[id] = progressPlayer(p, { facilitiesLevel: lvl, playingTime: 'remplacant' });
    });
  }

  // --- Sponsors
  let income = 0;
  for (const [sid, st] of Object.entries(save.sponsors)) {
    if (!st.signed) continue;
    income += Math.round(st.budget / SEASON_WEEKS);
    st.satisfaction = Math.max(0, Math.min(100, st.satisfaction + (l1Outcome === 'V' ? 2 : l1Outcome === 'D' ? -1 : 0)));
    if (st.satisfaction < 25) {
      st.signed = false;
      const def = data.sponsors.sponsors.find((s) => s.id === sid);
      report.lines.push(`${def.name} met fin à son partenariat.`);
      save.log.push({ week, text: `${def.name} quitte l’AJA (satisfaction trop basse).` });
    }
  }
  income += fixture.home ? 1500 : 0; // billetterie formation
  save.budget += income;
  report.income = income;

  // --- Messages et événements
  const lost = resolveRivalRisk(save, streamFor(save, 'rival'));
  for (const p of lost) report.lines.push(`Perdu : ${fullName(p)} a signé ailleurs.`);
  report.newMessages.push(...checkCoachMessages(save, streamFor(save, 'coach')).map((m) => m.title));
  const ev = surpriseEvent(save, data, streamFor(save, 'event'));
  if (ev) report.newMessages.push(ev.title);

  // --- Fin de semaine
  decayReputation(save);
  save.travelPointsLeft = TRAVEL_POINTS;
  const pos = sortedTable(save.table).findIndex((r) => r.id === 'auxerre') + 1;
  report.position = pos;
  save.log.push({ week, text: `J${week} : ${home.name} ${l1.homeGoals}-${l1.awayGoals} ${away.name} (${pos}e).` });
  save.log = save.log.slice(-60);
  save.lastReport = { ...report, l1: { ...report.l1, events: report.l1.events.slice(-40) } };

  if (week >= SEASON_WEEKS) {
    save.seasonOver = true;
    save.log.push({ week, text: `Fin de saison : l’AJA termine ${pos}e de Ligue 1.` });
  } else {
    save.week = week + 1;
  }
  return { save, report };
}

/** Promotion d'un jeune en équipe 1 (bouton « Faire monter en équipe 1 »). */
export function promoteToFirstTeam(save0, playerId) {
  const save = structuredClone(save0);
  const p = save.players[playerId];
  if (!p || p.team === 'A') return save0;
  const from = p.team;
  removeFromTeams(save, playerId);
  p.team = 'A';
  save.teams.A.players.push(playerId);
  save.goldenBook.push({ playerId, name: fullName(p), season: save.season, week: save.week, from, ovr: overall(p), originCity: p.originCity });
  save.log.push({ week: save.week, text: `${fullName(p)} monte en équipe 1 ! Inscrit au livre d’or.` });
  return save;
}

/** Nouvelle saison : vieillissement, départs des U19 de 19 ans, montées automatiques, recrutement U15. */
export function startNewSeason(save0, data) {
  const save = structuredClone(save0);
  const rng = streamFor(save, 'newseason');
  const [y1] = save.season.split('-').map(Number);
  const lines = [];
  for (const p of Object.values(save.players)) {
    if (['A', 'U19', 'U17', 'U15'].includes(p.team)) {
      p.age += 1;
      p.minutesThisSeason = 0;
    }
  }
  for (const id of save.teams.U19.players.slice()) {
    const p = save.players[id];
    if (p.age >= 19) {
      removeFromTeams(save, id);
      lines.push(`${fullName(p)} quitte les U19.`);
    }
  }
  for (const [from, to, age] of [['U17', 'U19', 17], ['U15', 'U17', 15]]) {
    for (const id of save.teams[from].players.slice()) {
      const p = save.players[id];
      if (p.age >= age) {
        save.teams[from].players = save.teams[from].players.filter((x) => x !== id);
        p.team = to;
        save.teams[to].players.push(id);
        if (to === 'U19') save.teams.U19.playingTime[id] = 'aucun';
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    const star = i < 3;
    addYouth(save, data, rng, {
      age: 13, team: 'U15', cityId: rng.pick(data.cities.cities).id,
      potBonus: star ? rng.int(8, 14) : 0, noticeWeek: star ? rng.int(2, 30) : 99,
    });
  }
  // Les joueurs partis sont nettoyés de la sauvegarde
  for (const [id, p] of Object.entries(save.players)) {
    if (p.team === 'PARTI' && !save.goldenBook.some((g) => g.playerId === id)) delete save.players[id];
  }
  save.season = `${y1 + 1}-${String(y1 + 2).slice(-2)}`;
  save.seasonIndex += 1;
  save.week = 1;
  save.seasonOver = false;
  save.results = [];
  save.keyResults = {};
  save.travelPointsLeft = TRAVEL_POINTS;
  const t = {};
  for (const id of Object.keys(save.table)) t[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  save.table = t;
  save.log.push({ week: 1, text: `Saison ${save.season} : ${lines.length} U19 quittent le centre, 7 nouveaux U15 arrivent.` });
  ensureFirstTeamLineup(save);
  return { save, lines };
}

export { groupOf };
