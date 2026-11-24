import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { newGame } from '../src/engine/setup.js';
import { doMission } from '../src/engine/activities.js';
import {
  allCards, openDailyPack, weeklyQuiz, answerWeekly, archiveUnlocked, grantEraCards, answerMatchQuiz, doLocalMission, localMissionOf, isoWeekKey,
} from '../src/engine/collection.js';
import { createService } from '../server/core.js';
import { memoryStorage } from '../server/storage.js';
import { loadServerContent } from '../server/content.js';

const data = loadData();
const game = () => newGame(data, { seed: 51 });

test('collection : cartes construites depuis les contenus, identifiants uniques', () => {
  const cards = allCards(data);
  assert.ok(cards.length >= 40);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  assert.ok(cards.some((c) => c.rarity === 'legendaire'));
});

test('carte du jour : une seule par jour', () => {
  const s = game();
  const r1 = openDailyPack(s, data, '2026-11-24');
  assert.ok(r1.result.card);
  assert.equal(openDailyPack(r1.save, data, '2026-11-24').result, null);
  assert.ok(openDailyPack(r1.save, data, '2026-11-25').result);
});

test('quiz hebdomadaire : 5 questions identiques pour tous, récompense à la fin', () => {
  const q1 = weeklyQuiz(data, '2026-11-23');
  const q2 = weeklyQuiz(data, '2026-11-29');
  assert.equal(q1.key, q2.key, 'même semaine ISO');
  assert.deepEqual(q1.qids, q2.qids);
  assert.notDeepEqual(weeklyQuiz(data, '2026-12-01').qids, q1.qids);
  assert.equal(isoWeekKey('2026-11-24'), '2026-S48');
  let s = game();
  let last;
  for (const qid of q1.qids) {
    last = answerWeekly(s, data, '2026-11-24', qid, data.heritage.questions[qid].answer);
    s = last.save;
  }
  assert.equal(last.reward.score, 5);
  assert.equal(last.reward.cards.length, 2);
  assert.ok(answerWeekly(s, data, '2026-11-24', q1.qids[0], 0).error);
});

test('mission de commune → carte de la commune ; époque → cartes ; archives débloquées', () => {
  let s = game();
  const r = doMission(s, data, 'avallon', data.territory.communes.avallon.mission.answer);
  assert.ok(r.save.collection.cards.includes('com-avallon'));
  s = grantEraCards(r.save, data, 'racines').save;
  assert.ok(s.collection.cards.includes('era-racines') && s.collection.cards.includes('mom-1905'));
  const arch = data.museum.archives.find((a) => a.id === 'a-patronage');
  assert.equal(archiveUnlocked(s, data, arch), false);
  s.community.heritage.items.push('racines');
  assert.equal(archiveUnlocked(s, data, arch), true);
});

test('match historique : bonne réponse = carte du match', () => {
  const s = game();
  const m = data.museum.matches[0];
  const ok = answerMatchQuiz(s, data, m.id, data.heritage.questions[m.quiz].answer);
  assert.ok(ok.correct && ok.save.collection.cards.includes(`match-${m.id}`));
});

test('mission locale : après la mission principale, une par semaine et par commune', () => {
  let s = game();
  assert.ok(doLocalMission(s, data, 'sens').result.error);
  s = doMission(s, data, 'sens', data.territory.communes.sens.mission.answer).save;
  const r = doLocalMission(s, data, 'sens');
  assert.ok(!r.result.error);
  assert.equal(r.result.title, localMissionOf(s, data, 'sens').title);
  assert.ok(doLocalMission(r.save, data, 'sens').result.error);
});

test('serveur : une question hors quiz de la semaine est refusée', async () => {
  const content = loadServerContent();
  const api = createService(memoryStorage(), { secret: 's', content, now: () => new Date('2026-11-24T10:00:00Z') });
  const { token } = await api.register({ displayName: 'Hebdo' });
  const { qids } = weeklyQuiz({ heritage: content.heritage }, '2026-11-24');
  const other = Object.keys(content.heritage.questions).find((q) => !qids.includes(q));
  const H = { authorization: `Bearer ${token}` };
  const bad = await api.submitActions(H, { actions: [{ type: 'weekQuiz', clientId: 'w1', payload: { qid: other, answer: 0 } }] });
  assert.equal(bad.rejected[0].reason, 'semaine');
  const good = await api.submitActions(H, { actions: [{ type: 'weekQuiz', clientId: 'w2', payload: { qid: qids[0], answer: content.heritage.questions[qids[0]].answer } }] });
  assert.equal(good.gained, 25);
});
