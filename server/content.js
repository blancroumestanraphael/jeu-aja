// Chargement des contenus nécessaires au serveur (vérification des réponses, communes, événements).
import { readFileSync } from 'node:fs';
import { buildContent } from './core.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
export const loadServerContent = () => buildContent({
  territory: read('../src/data/territory.json'),
  heritage: read('../src/data/heritage.json'),
  cities: read('../src/data/cities.json'),
  events: read('./content/events.json'),
});
