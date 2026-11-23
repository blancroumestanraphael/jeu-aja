import { readFileSync } from 'node:fs';
const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}.json`, import.meta.url)));
export const loadData = () => ({
  players: read('players'), clubs: read('clubs'), fixtures: read('fixtures'), cities: read('cities'),
  sponsors: read('sponsors'), academy: read('academy'), commentary: read('commentary'),
  territory: read('territory'), heritage: read('heritage'),
});
