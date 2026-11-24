import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './load-data.js';
import { newGame } from '../src/engine/setup.js';
import { migrateSave, SAVE_VERSION } from '../src/engine/migrations.js';
import { advanceWeek } from '../src/engine/week.js';

const data = loadData();

test('une sauvegarde v1 (avant V3) est migrée, pas effacée', () => {
  const s = newGame(data, { seed: 5 });
  const v1 = structuredClone(s);
  v1.version = 1;
  delete v1.community; delete v1.wageCap; delete v1.finances; delete v1.collection;
  for (const p of Object.values(v1.players)) { delete p.contract; delete p.matchStats; }
  const { save, migrated } = migrateSave(v1, data);
  assert.equal(save.version, SAVE_VERSION);
  assert.deepEqual(migrated, [2, 3]);
  assert.ok(save.community && save.wageCap && save.finances && save.collection);
  assert.ok(save.players.r_danois.contract);
  assert.equal(advanceWeek(save, data).save.week, 2);
});

test('une sauvegarde d’une version future ou illisible est refusée', () => {
  const s = newGame(data, { seed: 5 });
  assert.throws(() => migrateSave({ ...s, version: SAVE_VERSION + 1 }, data));
  assert.throws(() => migrateSave({ foo: 1 }, data));
});
