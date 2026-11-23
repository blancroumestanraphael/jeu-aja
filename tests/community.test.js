import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awardCommunity, claimChallenge, ensureCommunity } from '../src/engine/community.js';

function save(week = 3) {
  return { week, community: null };
}

test('initialise un profil supporter sans toucher au reste de la sauvegarde', () => {
  const s = save();
  ensureCommunity(s);
  assert.equal(s.community.displayName, 'Supporter AJA');
  assert.equal(s.community.xp, 0);
  assert.deepEqual(s.community.visitedCities, []);
});

test('les activités donnent des XP et enregistrent la découverte territoriale', () => {
  const s = save();
  awardCommunity(s, 15, { activity: true, cityId: 'joigny' });
  assert.equal(s.community.xp, 15);
  assert.equal(s.community.weekly.activities, 1);
  assert.equal(s.community.weekly.newCity, true);
  assert.deepEqual(s.community.visitedCities, ['joigny']);
});

test('un défi hebdomadaire ne peut être récupéré qu’une fois', () => {
  const s = save();
  assert.equal(claimChallenge(s, 'territory', 30), true);
  assert.equal(claimChallenge(s, 'territory', 30), false);
  assert.equal(s.community.xp, 30);
});

test('les objectifs hebdomadaires repartent à zéro quand la semaine change', () => {
  const s = save();
  awardCommunity(s, 15, { activity: true, cityId: 'sens' });
  s.week += 1;
  ensureCommunity(s);
  assert.equal(s.community.xp, 15);
  assert.equal(s.community.weekly.activities, 0);
  assert.equal(s.community.weekly.newCity, false);
});
