// Point d'entrée : chargement des données, routeur par hash, barre d'onglets.

import { loadData, createStore } from './state/store.js';
import { crest, esc } from './ui/components.js';
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
import heritage from './screens/heritage.js';
import contracts from './screens/contracts.js';
import { touchDay, isoDay } from './engine/community.js';

const SCREENS = { home, team, u19, player, map, messages, match, table, gold, supporter, heritage, contracts, welcome };
// 5 onglets orientés supporter ; les messages passent dans l'en-tête.
const TABS = [
  { id: 'home', label: 'Accueil', icon: '<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>' },
  { id: 'team', label: 'Club', icon: '<path d="M12 2 20 5v7c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5z"/>' },
  { id: 'map', label: 'Yonne', icon: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>' },
  { id: 'heritage', label: 'Patrimoine', icon: '<path d="M12 2 2 7v2h20V7zM4 10h3v8H4zm6.5 0h3v8h-3zM17 10h3v8h-3zM2 20h20v2H2z"/>' },
  { id: 'supporter', label: 'Supporter', icon: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>' },
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
        <span class="chip" title="Semaine de jeu">S${save.week}/34</span>
        <span class="chip" title="Points de déplacement dans l\u2019Yonne">🚗 ${save.travelPointsLeft}</span>
        <a class="bell" href="#/messages" aria-label="Messages${pendingCount(save) ? ` (${pendingCount(save)} en attente)` : ''}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>
          ${pendingCount(save) ? `<span class="badge">${pendingCount(save)}</span>` : ''}
        </a>
      </div>
    </header>`;
}

const pendingCount = (save) => save.messages.filter((m) => m.status === 'pending').length;

function tabbar(active) {
  return `
    <nav class="tabbar" aria-label="Navigation principale">
      ${TABS.map(
        (t) => `
        <a href="#/${t.id}" class="tab ${active === t.id ? 'active' : ''}" ${active === t.id ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${t.icon}</svg>
          <span>${t.label}</span>
        </a>`,
      ).join('')}
    </nav>`;
}

const TAB_OF = { player: null, match: null, messages: null, table: 'team', u19: 'team', contracts: 'team', gold: 'heritage' };

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
    ? `${header(save)}<main class="screen screen-${route.name}" id="main">${body}</main>${screen.fullscreen ? '' : tabbar(activeTab)}`
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
    const had = await store.init();
    if (had) store.set(touchDay(store.save, isoDay())); // ancienneté : jour de visite
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
