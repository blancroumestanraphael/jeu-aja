import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { createRng } from '../src/engine/rng.js';
import { simulateMatch, clubTeam } from '../src/engine/match.js';
import { attributeDelta } from '../src/engine/progression.js';
import { newGame } from '../src/engine/setup.js';
import { advanceWeek, startNewSeason, promoteToFirstTeam } from '../src/engine/week.js';
import { doActivity, meetParents } from '../src/engine/activities.js';
import { answerMessage } from '../src/engine/events.js';
import { createKeyMatch, playKeySegment } from '../src/engine/keymatch.js';
import { overall } from '../src/engine/players.js';
import { sortedTable } from '../src/engine/league.js';

const data = loadData();

test('même graine = même résultat de match', () => {
  const psg = data.clubs.clubs.find((c) => c.id === 'psg');
  const aja = data.clubs.clubs.find((c) => c.id === 'auxerre');
  const a = simulateMatch(clubTeam(aja, { isHome: true }), clubTeam(psg), createRng(42), { templates: data.commentary });
  const b = simulateMatch(clubTeam(aja, { isHome: true }), clubTeam(psg), createRng(42), { templates: data.commentary });
  assert.deepEqual(a, b);
  assert.ok(a.events.some((e) => e.type === 'fulltime'));
});

test('formule de progression du brief', () => {
  // 0,4 × (82−58)/82 × 1,5 × 1 × 1,3 × 1,3
  const d = attributeDelta({ potential: 82, value: 58, attr: 'technique', focus: 'technique', facilitiesLevel: 1, playingTime: 'titulaire', age: 17 });
  assert.ok(Math.abs(d - 0.4 * (24 / 82) * 1.5 * 1.3 * 1.3) < 1e-9);
  assert.equal(attributeDelta({ potential: 70, value: 70, attr: 'mental', focus: 'x', facilitiesLevel: 1, playingTime: 'aucun', age: 20 }), 0);
});

test('nouvelle partie : vrais joueurs en équipe 1, 22 U19', () => {
  const s = newGame(data, { seed: 1 });
  assert.equal(s.teams.A.players.length, data.players.players.length);
  assert.equal(overall(s.players.r_danois), 76);
  assert.equal(s.teams.U19.players.length, 22);
  assert.equal(s.teams.A.starters.length, 11);
  assert.ok(s.teams.A.starters.every(Boolean));
});

test('une saison complète de 34 semaines, déterministe', () => {
  const run = () => {
    let s = newGame(data, { seed: 918273 });
    for (let i = 0; i < 34; i++) {
      // répondre aux coachs : accepter
      for (const m of s.messages.filter((m) => m.status === 'pending')) s = answerMessage(s, m.id, m.choices[0], createRng(i));
      s = advanceWeek(s, data).save;
    }
    return s;
  };
  const s1 = run();
  const s2 = run();
  assert.equal(s1.seasonOver, true);
  assert.deepEqual(s1.table, s2.table);
  const total = sortedTable(s1.table).reduce((n, r) => n + r.p, 0);
  assert.equal(total, 18 * 34);
  const top = sortedTable(s1.table);
  console.log('Classement final :', top.map((r) => `${r.id} ${r.pts}`).join(', '));
  assert.ok(s1.messages.some((m) => m.kind === 'coach'), 'au moins un message de coach');
  const { save: ns } = startNewSeason(s1, data);
  assert.equal(ns.week, 1);
  assert.equal(ns.season, '2027-28');
  assert.ok(ns.teams.U19.players.every((id) => ns.players[id].age < 19));
});

test('activités de la carte et parents', () => {
  let s = newGame(data, { seed: 7 });
  const r = doActivity(s, data, 'joigny', 'tournoi', createRng(3));
  s = r.save;
  assert.equal(r.result.revealed.length, 3);
  assert.equal(s.travelPointsLeft, 1);
  assert.equal(s.cities.joigny.reputation, 28);
  const pid = s.prospects[0].playerId;
  const r2 = meetParents(s, data, pid, s.players[pid].familyPriority, createRng(5));
  assert.equal(r2.save.travelPointsLeft, 0);
  const r3 = doActivity(r2.save, data, 'sens', 'coach', createRng(1));
  assert.ok(r3.result.error);
});

test('match de la veille en 3 temps forts', () => {
  let s = newGame(data, { seed: 3 });
  s.week = 17; // PSG
  const km = createKeyMatch(s, data);
  playKeySegment(km, data, null);
  for (const c of ['presser', 'contre', 'bloc']) { km.choices.push(c); playKeySegment(km, data, c); }
  assert.equal(km.state.finished, true);
});

test('faire monter un U19 en équipe 1 → livre d\'or', () => {
  const s = newGame(data, { seed: 9 });
  const id = s.teams.U19.players[0];
  const s2 = promoteToFirstTeam(s, id);
  assert.ok(s2.teams.A.players.includes(id));
  assert.equal(s2.goldenBook.length, 1);
});
