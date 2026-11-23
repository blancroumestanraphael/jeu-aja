// Point d'entrée : chargement des données, routeur par hash, barre d'onglets.

import { loadData, createStore } from './state/store.js';
import { crest, esc, euro } from './ui/components.js';
import home from './screens/home.js';
import team from './screens/team.js';
import u19 from './screens/u19.js';
import player from './screens/player.js';
import map from './screens/map.js';
import messages from './screens/messages.js';
import match from './screens/match.js';
import table from './screens/table.js';
import gold from './screens/gold.js';
import welcome from './screens/welcome.js';
import supporter from './screens/supporter.js';

const SCREENS = { home, team, u19, player, map, messages, match, table, gold, supporter, welcome };
const TABS = [
  { id: 'home', label: 'Accueil', icon: '<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>' },
  { id: 'team', label: 'Équipe 1', icon: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7z"/>' },
  { id: 'u19', label: 'U19', icon: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6zM14 20c0-2 .6-3.7 1.6-5 2.9-.4 6.4 1.4 6.4 5z"/>' },
  { id: 'map', label: 'Carte', icon: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' },
  { id: 'messages', label: 'Messages', icon: '<path d="M3 5h18v12H8l-5 4z"/>' },
  { id: 'supporter', label: 'Supporter', icon: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-4.2 3.4-7 8-7s8 2.8 8 7"/>' },
];

const app = document.getElementById('app');
let store;
let data;

function parseRoute() {
  const [, name = 'home', param] = (location.hash || '#/home').split('/');
  return { name: SCREENS[name] ? name : 'home', param: param ? decodeURIComponent(param) : null };
}

export function go(name, param) {
  const h = `#/${name}${param ? '/' + encodeURIComponent(param) : ''}`;
  if (location.hash === h) render();
  else location.hash = h;
}

function header(save) {
  return `
    <header class="topbar">
      <a href="#/home" class="brand">${crest(30)}<span>Génération <b>AJA</b></span></a>
      <div class="top-stats">
        <span class="chip" title="Semaine">S${save.week}/34</span>
        <span class="chip" title="Budget">${euro(save.budget)}</span>
        <span class="chip" title="Points de déplacement">🚗 ${save.travelPointsLeft}</span>
      </div>
    </header>`;
}

function tabbar(active, save) {
  const pending = save.messages.filter((m) => m.status === 'pending').length;
  return `
    <nav class="tabbar" aria-label="Navigation principale">
      ${TABS.map(
        (t) => `
        <a href="#/${t.id}" class="tab ${active === t.id ? 'active' : ''}" ${active === t.id ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${t.icon}</svg>
          <span>${t.label}</span>
          ${t.id === 'messages' && pending ? `<span class="badge">${pending}</span>` : ''}
        </a>`,
      ).join('')}
    </nav>`;
}

const TAB_OF = { player: null, match: null, table: 'home', gold: 'home' };

let currentCleanup = null;

export function render() {
  currentCleanup?.();
  currentCleanup = null;
  const save = store.save;
  const route = save ? parseRoute() : { name: 'welcome' };
  const screen = SCREENS[route.name];
  const ctx = { store, data, go, render, param: route.param };
  const body = screen.render(ctx);
  const activeTab = route.name in TAB_OF ? TAB_OF[route.name] : route.name;
  app.innerHTML = save && route.name !== 'welcome'
    ? `${header(save)}<main class="screen screen-${route.name}" id="main">${body}</main>${screen.fullscreen ? '' : tabbar(activeTab, save)}`
    : `<main class="screen screen-welcome">${body}</main>`;
  const root = app.querySelector('main');
  currentCleanup = screen.bind?.(root, ctx) || null;
  if (!screen.keepScroll) window.scrollTo(0, 0);
}

async function boot() {
  app.innerHTML = `<div class="loading">${crest(64)}<p>Chargement…</p></div>`;
  try {
    data = await loadData();
    store = createStore(data);
    await store.init();
  } catch (e) {
    app.innerHTML = `<div class="loading"><p>Impossible de charger le jeu.</p><p class="muted small">${esc(e.message)}</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  render();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

boot();
