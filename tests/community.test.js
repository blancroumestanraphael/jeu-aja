import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { createRng } from '../src/engine/rng.js';
import { newGame } from '../src/engine/setup.js';
import { advanceWeek, startNewSeason, promoteToFirstTeam } from '../src/engine/week.js';
import { doMission, meetParents, doActivity, partnerMission } from '../src/engine/activities.js';
import {
  recordEvent, claimChallenge, touchDay, currentStreak, answerDaily, answerHeritage, achievements,
  levelFor, xpForLevel, hasPerk, collectiveChallenges, MOBILISATION_XP,
} from '../src/engine/community.js';
import { createKeyMatch, saveKeyResult, playKeySegment } from '../src/engine/keymatch.js';

const data = loadData();
const game = (seed = 11) => newGame(data, { seed });

test('recordEvent est pur et les objectifs repartent à zéro chaque semaine', () => {
  const s = game();
  const s2 = recordEvent(s, 'activity', { cityId: 'sens' });
  assert.equal(s.community.xp, 0, 'la sauvegarde d’origine n’est pas modifiée');
  assert.equal(s2.community.weekly.activities, 1);
  const s3 = advanceWeek(s2, data).save;
  assert.equal(s3.community.weekly.activities, 0);
  assert.ok(s3.community.xp > s2.community.xp, 'XP de fidélité hebdomadaire');
});

test('un défi hebdo se récupère une fois, et de nouveau la saison suivante (bug corrigé)', () => {
  let s = recordEvent(game(), 'activity', { cityId: 'sens' });
  const r1 = claimChallenge(s, 'territoire');
  assert.equal(r1.ok, true);
  assert.equal(claimChallenge(r1.save, 'territoire').ok, false);
  // Saison suivante, même numéro de semaine
  s = r1.save;
  s.seasonOver = true;
  s = startNewSeason(s, data).save;
  assert.equal(s.week, 1);
  s = recordEvent(s, 'activity', { cityId: 'joigny' });
  assert.equal(claimChallenge(s, 'territoire').ok, true);
});

test('la mission de la commune débloque le recrutement ; une mauvaise réponse non', () => {
  const s = game();
  const m = data.territory.communes.sens.mission;
  const fail = doMission(s, data, 'sens', (m.answer + 1) % m.choices.length);
  assert.equal(fail.result.success, false);
  assert.ok(doActivity(fail.save, data, 'sens', 'coach', createRng(1)).result.error);
  const ok = doMission(s, data, 'sens', m.answer);
  assert.equal(ok.result.success, true);
  assert.ok(!doActivity(ok.save, data, 'sens', 'coach', createRng(1)).result.error);
  assert.equal(ok.save.community.weekly.newCity, true);
});

test('la rencontre avec les parents compte comme activité et visite', () => {
  let s = doMission(game(), data, 'toucy', data.territory.communes.toucy.mission.answer).save;
  s = doActivity(s, data, 'toucy', 'coach', createRng(2)).save;
  s.travelPointsLeft = 2;
  const weeklyBefore = s.community.weekly.activities;
  const pid = s.prospects[0].playerId;
  const r = meetParents(s, data, pid, s.players[pid].familyPriority, createRng(4));
  assert.equal(r.save.community.weekly.activities, weeklyBefore + 1);
});

test('les niveaux supporter ont des effets en jeu', () => {
  let s = game();
  assert.equal(levelFor(0), 1);
  s.community.xp = xpForLevel(4);
  assert.equal(hasPerk(s, 'carnet'), true);
  s = advanceWeek(s, data).save;
  assert.equal(s.travelPointsLeft, 3);
});

test('mobilisation avant un grand match : bonus quand l’objectif XP est atteint', () => {
  let s = game();
  s.week = 3; // Lyon, grand match
  s = recordEvent(s, 'activity', { cityId: 'sens' });
  s.community.weekly.xp = MOBILISATION_XP;
  const mob = collectiveChallenges(s, data).find((c) => c.id === 'mobilisation');
  assert.equal(mob.active, true);
  assert.ok(mob.value >= mob.target);
  const km = createKeyMatch(s, data);
  const plain = createKeyMatch({ ...s, community: { ...s.community, weekly: { ...s.community.weekly, xp: 0 } } }, data);
  assert.equal(Math.round(km.away.morale - plain.away.morale), 5);
  playKeySegment(km, data, null);
  for (const c of ['presser', 'contre', 'bloc']) { km.choices.push(c); playKeySegment(km, data, c); }
  const saved = saveKeyResult(s, km);
  assert.equal(saved.community.stats.keyMatches, 1);
});

test('« Passeur de formation » exige un formé installé (270 min), pas une simple montée', () => {
  let s = game();
  const id = s.teams.U19.players[0];
  s = promoteToFirstTeam(s, id);
  const ach = () => achievements(s, data, '2026-11-23').find((a) => a.id === 'passeur').ok;
  assert.equal(ach(), false);
  s.teams.A.starters[5] = id;
  for (let i = 0; i < 3; i++) s = advanceWeek(s, data).save;
  assert.equal(s.community.stats.alumniEstablished, 1);
  assert.equal(s.goldenBook[0].established, true);
  assert.equal(ach(), true);
});

test('ancienneté : jours actifs et série', () => {
  let s = game();
  s = touchDay(s, '2026-11-21');
  s = touchDay(s, '2026-11-22');
  s = touchDay(s, '2026-11-22');
  s = touchDay(s, '2026-11-23');
  assert.equal(s.community.activeDays.length, 3);
  assert.equal(s.community.firstSeen, '2026-11-21');
  assert.equal(currentStreak(s.community.activeDays, '2026-11-23'), 3);
});

test('question du jour : une seule réponse par jour', () => {
  const s = game();
  const r = answerDaily(s, data.heritage, '2026-11-23', 0);
  assert.notEqual(r.correct, null);
  assert.equal(answerDaily(r.save, data.heritage, '2026-11-23', 0).correct, null);
});

test('mission historique : une époque complétée débloque un objet et un mécène', () => {
  let s = game();
  const era = data.heritage.eras[0];
  const budget = s.budget;
  let last;
  for (const qid of era.quiz) {
    last = answerHeritage(s, data.heritage, era.id, qid, data.heritage.questions[qid].answer);
    s = last.save;
  }
  assert.deepEqual(last.unlocked, era.reward);
  assert.equal(s.budget, budget + 1500);
  assert.ok(achievements(s, data, '2026-11-23').find((a) => a.id === 'historien').ok);
});

test('mission partenaire : seulement pour un partenaire signé, une fois', () => {
  const s = game();
  assert.ok(partnerMission(s, data, 's_sens').result.error);
  const r = partnerMission(s, data, 's_garage');
  assert.ok(!r.result.error);
  assert.ok(partnerMission(r.save, data, 's_garage').result.error);
});
