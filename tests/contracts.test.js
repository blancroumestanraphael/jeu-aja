import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { newGame } from '../src/engine/setup.js';
import { advanceWeek, startNewSeason, promoteToFirstTeam } from '../src/engine/week.js';
import {
  marketValue, wageDemand, makeOffer, canNegotiate, wageBill, agentBrief, preferredYears, MAX_ROUNDS, expiringContracts,
} from '../src/engine/contracts.js';
import { overall } from '../src/engine/players.js';

const data = loadData();
const game = () => newGame(data, { seed: 31 });

test('chaque joueur a un contrat ; les prêts sont identifiés', () => {
  const s = game();
  for (const id of s.teams.A.players) assert.ok(s.players[id].contract, id);
  assert.equal(s.players.r_faivre.contract.type, 'pret');
  assert.equal(s.players.r_faivre.contract.loanFrom, 'AFC Bournemouth');
  assert.equal(s.players[s.teams.U19.players[0]].contract.type, 'formation');
  assert.ok(wageBill(s) <= s.wageCap);
});

test('valeur marchande : un jeune à potentiel vaut plus qu’un vétéran de même note', () => {
  const young = { age: 20, potential: 82, attributes: { technique: 70, physique: 70, mental: 70, vision: 70 } };
  const old = { age: 32, potential: 70, attributes: { technique: 70, physique: 70, mental: 70, vision: 70 } };
  assert.ok(marketValue(young) > marketValue(old) * 3);
  assert.ok(marketValue(young, { yearsLeft: 1 }) < marketValue(young, { yearsLeft: 4 }));
});

test('négociation : offre basse refusée, contre-offre, puis accord', () => {
  let s = game();
  const p = s.players.r_danois;
  const demand = wageDemand(p, 'titulaire');
  const years = preferredYears(p);
  const low = makeOffer(s, p.id, { wage: Math.round(demand * 0.6 * 10) / 10, years, role: 'titulaire' });
  assert.equal(low.result.outcome, 'refuse');
  s = low.save;
  const near = makeOffer(s, p.id, { wage: Math.round(demand * 0.93 * 10) / 10, years, role: 'titulaire' });
  assert.equal(near.result.outcome, 'counter');
  s = near.save;
  const ok = makeOffer(s, p.id, near.result.counter);
  assert.equal(ok.result.outcome, 'accept');
  assert.ok(ok.save.players.r_danois.contract.until > s.players.r_danois.contract.until - 1);
  assert.equal(ok.save.players.r_danois.contract.promise, 'titulaire');
});

test('négociation : nombre d’offres limité par semaine, masse salariale respectée', () => {
  let s = game();
  for (let i = 0; i < MAX_ROUNDS; i++) s = makeOffer(s, 'r_okoh', { wage: 0.5, years: 3, role: 'rotation' }).save;
  assert.equal(canNegotiate(s, s.players.r_okoh).ok, false);
  s = advanceWeek(s, data).save;
  assert.equal(canNegotiate(s, s.players.r_okoh).ok, true);
  const huge = makeOffer(s, 'r_okoh', { wage: 9999, years: 3, role: 'rotation' });
  assert.equal(huge.result.outcome, 'error');
  assert.equal(canNegotiate(s, s.players.r_faivre).ok, false, 'joueur prêté');
});

test('un U19 sous contrat pro est protégé ; un promu reçoit un contrat pro', () => {
  let s = game();
  const id = s.teams.U19.players[0];
  const b = agentBrief(s, s.players[id]);
  const r = makeOffer(s, id, { wage: b.wage, years: b.years, role: 'rotation' });
  assert.equal(r.result.outcome, 'accept');
  assert.equal(r.save.players[id].contract.type, 'pro');
  const id2 = s.teams.U19.players[1];
  s = promoteToFirstTeam(s, id2);
  assert.equal(s.players[id2].contract.type, 'pro');
});

test('fin de saison : fins de contrat et prêts quittent le club, l’effectif est complété', () => {
  let s = game();
  const leaving = expiringContracts(s).map((p) => p.id);
  assert.ok(leaving.includes('r_faivre'));
  for (let i = 0; i < 34; i++) s = advanceWeek(s, data).save;
  assert.ok(s.messages.some((m) => m.id.startsWith('ctr_')), 'rappel en semaine 24');
  const { save, lines } = startNewSeason(s, data);
  for (const id of leaving) assert.ok(!save.teams.A.players.includes(id), id);
  assert.ok(lines.some((l) => l.includes('Bournemouth')));
  assert.ok(save.teams.A.players.length >= 18);
  assert.ok(save.teams.A.starters.every(Boolean));
  assert.ok(overall(save.players[save.teams.A.starters[0]]) > 0);
});
