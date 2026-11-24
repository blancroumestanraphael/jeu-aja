import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { createRng } from '../src/engine/rng.js';
import { newGame } from '../src/engine/setup.js';
import { advanceWeek, startNewSeason } from '../src/engine/week.js';
import { planFactor, ensureAvailableLineup, updateCohesion, isAvailable } from '../src/engine/squad.js';
import { generateMarket, buyPlayer, generateOffers, answerOffer, loanOut, raiseWageCap, windowOf } from '../src/engine/mercato.js';
import { careerScenarios } from '../src/engine/projection.js';

const data = loadData();
const game = (seed = 41) => newGame(data, { seed });

test('plan de jeu : pressing > possession > contre > pressing ; l’analyste amplifie', () => {
  assert.ok(planFactor('pressing', 'possession') > 1);
  assert.ok(planFactor('possession', 'pressing') < 1);
  assert.ok(planFactor('contre', 'pressing') > 1);
  assert.equal(planFactor('contre', 'contre'), 1);
  assert.ok(planFactor('pressing', 'possession', 3) > planFactor('pressing', 'possession', 1));
});

test('cohésion : XI stable = hausse, gros remaniement = baisse', () => {
  const xi = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
  assert.equal(updateCohesion(60, xi, xi), 63);
  assert.equal(updateCohesion(60, xi, ['z', 'y', 'x', 'w', ...xi.slice(4)]), 55);
});

test('blessés et suspendus sont remplacés dans le XI', () => {
  const s = game();
  const out = s.teams.A.starters[3];
  s.players[out].injury = { label: 'entorse', weeks: 2 };
  const changes = ensureAvailableLineup(s);
  assert.equal(changes.length, 1);
  assert.ok(!s.teams.A.starters.includes(out));
  assert.ok(s.teams.A.starters.every((id) => isAvailable(s.players[id])));
});

test('une saison produit notes, blessures, cartons ; les blessures guérissent', () => {
  let s = game(42);
  let injuries = 0;
  for (let i = 0; i < 34; i++) {
    const r = advanceWeek(s, data);
    s = r.save;
    injuries += r.report.lines.filter((l) => l.startsWith('🚑')).length;
  }
  assert.ok(injuries > 0, 'au moins une blessure sur une saison');
  const danois = s.players.r_danois;
  assert.ok(danois.matchStats.apps > 0 && danois.matchStats.ratingSum / danois.matchStats.apps > 3);
  const { save } = startNewSeason(s, data);
  assert.equal(save.players.r_danois.careerLog.length, 1);
  assert.equal(save.players.r_danois.careerLog[0].season, '2026-27');
  assert.ok(save.finances.transferBudget > s.finances.transferBudget, 'droits TV versés');
});

test('mercato : marché fictif, achat avec contre-offre, budget et cohésion', () => {
  let s = game();
  assert.ok(windowOf(1));
  generateMarket(s, data);
  const item = s.market.players[0];
  const low = buyPlayer(s, item.player.id, item.asking * 0.5);
  assert.equal(low.result.outcome, 'refuse');
  const mid = buyPlayer(s, item.player.id, Math.round(item.asking * 0.9 * 10) / 10);
  if (item.asking * 0.9 <= s.finances.transferBudget) assert.equal(mid.result.outcome, 'counter');
  s.finances.transferBudget = 50;
  s.wageCap = 500;
  const ok = buyPlayer(s, item.player.id, item.asking);
  assert.equal(ok.result.outcome, 'accept');
  assert.ok(ok.save.teams.A.players.includes(item.player.id));
  assert.ok(ok.save.finances.transferBudget < 50);
  assert.ok(ok.save.cohesion < s.cohesion);
  s.week = 10;
  assert.equal(buyPlayer(s, item.player.id, item.asking).result.outcome, 'error', 'mercato fermé');
});

test('offres reçues : vente et budget', () => {
  let s = game();
  s.players.r_okoh.transferListed = true;
  const offers = generateOffers(s, createRng(3));
  const m = offers.find((x) => x.playerId === 'r_okoh');
  assert.ok(m);
  const before = s.finances.transferBudget;
  s = answerOffer(s, m.id, 'sell', createRng(1));
  assert.ok(!s.teams.A.players.includes('r_okoh'));
  assert.ok(s.finances.transferBudget > before);
});

test('prêt : le jeune joue ailleurs et revient en fin de saison', () => {
  let s = game();
  const id = s.teams.U19.players.find((x) => s.players[x].age >= 17);
  const r = loanOut(s, id, createRng(2));
  assert.ok(!r.result.error);
  s = r.save;
  assert.equal(s.players[id].team, 'LOAN');
  const before = s.players[id].minutesThisSeason;
  for (let i = 0; i < 34; i++) s = advanceWeek(s, data).save;
  assert.ok(s.players[id].minutesThisSeason > before);
  const { save, lines } = startNewSeason(s, data);
  assert.equal(save.players[id].team, 'U19');
  assert.ok(lines.some((l) => l.includes('revient de prêt')));
});

test('arbitrage financier : budget transferts → plafond salarial', () => {
  const s = game();
  const r = raiseWageCap(s);
  assert.equal(r.save.wageCap, s.wageCap + 5);
  assert.equal(r.save.finances.transferBudget, s.finances.transferBudget - 1);
});

test('trajectoires : les choix changent la projection', () => {
  const s = game();
  const p = s.players[s.teams.U19.players[0]];
  const sc = Object.fromEntries(careerScenarios(s, p).map((x) => [x.id, x.points[3].ovrExact]));
  assert.ok(sc.titulaire > sc.remplacant && sc.remplacant > sc.sansJouer);
  assert.ok(sc.pret > sc.sansJouer);
});
