import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { newGame } from '../src/engine/setup.js';
import { dailyObjectives, nextStep, reminders, agenda } from '../src/engine/guide.js';
import { openDailyPack } from '../src/engine/collection.js';
import { migrateSave } from '../src/engine/migrations.js';

const data = loadData();

test('objectifs du jour : toujours une prochaine étape, qui avance quand on agit', () => {
  let s = newGame(data, { seed: 61 });
  const today = '2026-11-24';
  assert.equal(nextStep(s, data, today).id, 'pack');
  s = openDailyPack(s, data, today).save;
  assert.notEqual(nextStep(s, data, today).id, 'pack');
  assert.ok(dailyObjectives(s, data, today).some((o) => o.id === 'mission'));
  assert.ok(dailyObjectives(s, data, today).some((o) => o.id === 'mercato'), 'mercato ouvert en semaine 1');
});

test('rappels : Match de la veille la veille d’un grand match réel', () => {
  const s = newGame(data, { seed: 62 });
  const r = reminders(s, data, '2026-11-28', new Date('2026-11-28T10:00:00'));
  assert.ok(r.some((x) => x.text.includes('Match de la veille')));
});

test('agenda : vrais matchs à venir et rendez-vous', () => {
  const a = agenda(newGame(data, { seed: 63 }), data, '2026-11-24');
  assert.equal(a.matches[0].opponent, 'marseille');
  assert.ok(a.daily.length && a.weekly.length && a.seasonal.length);
});

test('tutoriel : nouvelle partie oui, ancienne partie migrée non', () => {
  assert.equal(newGame(data, { seed: 64 }).onboarding.done, false);
  const old = newGame(data, { seed: 64 });
  delete old.onboarding;
  old.version = 2;
  assert.equal(migrateSave(old, data).save.onboarding.done, true);
});
