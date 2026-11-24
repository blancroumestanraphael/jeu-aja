// Contrôle d'équilibrage : simule N saisons complètes (composition automatique) et résume les résultats.
// Usage : npm run balance [-- 50]
import { loadData } from '../tests/load-data.js';
import { newGame } from '../src/engine/setup.js';
import { advanceWeek } from '../src/engine/week.js';
import { sortedTable } from '../src/engine/league.js';

const N = Number(process.argv[2]) || 30;
const data = loadData();
const pos = [];
let goals = 0, matches = 0, draws = 0;
const champ = {};
const ptsByRank = Array(18).fill(0);
for (let seed = 1; seed <= N; seed++) {
  let s = newGame(data, { seed });
  for (let i = 0; i < 34; i++) s = advanceWeek(s, data).save;
  const t = sortedTable(s.table);
  pos.push(t.findIndex((r) => r.id === 'auxerre') + 1);
  champ[t[0].id] = (champ[t[0].id] || 0) + 1;
  t.forEach((r, i) => { ptsByRank[i] += r.pts / N; });
  for (const r of s.results.filter((x) => x.comp === 'L1')) {
    goals += r.hg + r.ag; matches++; if (r.hg === r.ag) draws++;
  }
}
pos.sort((a, b) => a - b);
const mean = pos.reduce((a, b) => a + b) / N;
console.log(`AJA (${N} saisons) : position moyenne ${mean.toFixed(1)}, médiane ${pos[N >> 1]}, relégation (17-18e) ${pos.filter((p) => p >= 17).length}/${N}`);
console.log(`Buts par match : ${(goals / matches).toFixed(2)} · nuls : ${((draws / matches) * 100).toFixed(0)} %`);
console.log(`Champions : ${JSON.stringify(champ)}`);
console.log(`Points moyens par rang : ${ptsByRank.map((x) => x.toFixed(0)).join(' ')}`);
