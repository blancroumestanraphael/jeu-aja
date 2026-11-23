import { esc, clubNav, playerRow, stars, moraleIcon, toast } from '../ui/components.js';
import { overall, ATTRS, ATTR_LABELS } from '../engine/players.js';
import { autoLineup } from '../engine/lineup.js';

let view = 'U19';
let sort = 'note';

const PT = { titulaire: 'T', remplacant: 'R', aucun: '–' };

export default {
  keepScroll: true,
  render({ store }) {
    const s = store.save;
    const team = s.teams[view];
    const players = team.players.map((id) => s.players[id]);
    const sorter = { note: (a, b) => overall(b) - overall(a), potentiel: (a, b) => b.potential - a.potential, age: (a, b) => a.age - b.age || overall(b) - overall(a) }[sort];
    players.sort(sorter);
    const coach = Object.values(s.coaches).find((c) => c.team === view);
    const tit = view === 'U19' ? players.filter((p) => team.playingTime[p.id] === 'titulaire').length : 0;

    const rows = players.map((p) => {
      if (view !== 'U19') return playerRow(p);
      const pt = team.playingTime[p.id] || 'aucun';
      return `
      ${clubNav('u19')}
        <div class="u19-row">
          ${playerRow(p, { sub: `${p.age} ans · ${stars(p.potential)} · ${moraleIcon(p.morale)} · ${p.minutesThisSeason}′` })}
          <div class="u19-ctl">
            <div class="seg" role="group" aria-label="Temps de jeu">
              ${Object.entries(PT).map(([k, l]) => `<button class="${pt === k ? 'on' : ''}" data-pt="${k}" data-id="${p.id}" title="${k}">${l}</button>`).join('')}
            </div>
            <select data-focus="${p.id}" aria-label="Axe d’entraînement">
              ${ATTRS.map((a) => `<option value="${a}" ${p.trainingFocus === a ? 'selected' : ''}>${ATTR_LABELS[a]}</option>`).join('')}
            </select>
          </div>
        </div>`;
    }).join('');

    return `
      <section class="identity-banner">
        <b>🌱 Le centre de formation, l\u2019ADN de l\u2019AJA</b>
        <span>Depuis Guy Roux, l\u2019AJA fait grandir ses joueurs. Chaque jeune que vous installez en équipe 1 entre dans le <a href="#/gold">livre d\u2019or</a>.</span>
      </section>
      <div class="tabs-inline" role="tablist">
        ${['U19', 'U17', 'U15'].map((t) => `<button role="tab" class="${view === t ? 'on' : ''}" data-view="${t}">${t}${t !== 'U19' ? ' <small>simulé</small>' : ''}</button>`).join('')}
      </div>
      <div class="card row-between">
        <div><b>${esc(coach?.name || 'Coach')}</b><br><span class="small muted">Confiance ${coach?.trust ?? '–'}/100 · ${players.length} joueurs</span></div>
        ${view === 'U19' ? `<div class="center"><b class="${tit === 11 ? 'ok' : 'warn'}">${tit}/11</b><br><span class="small muted">titulaires</span></div>
        <button class="btn btn-small" data-action="auto">Auto</button>` : ''}
      </div>
      ${view === 'U19'
        ? '<p class="hint">Temps de jeu : <b>T</b> titulaire (×1,3), <b>R</b> remplaçant (×1,0), <b>–</b> sans minutes (×0,7). L’axe choisi progresse ×1,5.</p>'
        : '<p class="hint">Catégorie simulée : progression automatique. Le coach vous écrit quand un jeune est prêt à monter.</p>'}
      <div class="sortbar">Trier :
        ${['note', 'potentiel', 'age'].map((k) => `<button class="${sort === k ? 'on' : ''}" data-sort="${k}">${k === 'age' ? 'âge' : k}</button>`).join('')}
      </div>
      <div class="list">${rows || '<p class="muted">Aucun joueur.</p>'}</div>`;
  },

  bind(root, { store, render, go }) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-view],[data-sort],[data-pt],[data-action]');
      if (!t) return;
      if (t.dataset.view) { view = t.dataset.view; render(); }
      else if (t.dataset.sort) { sort = t.dataset.sort; render(); }
      else if (t.dataset.pt) {
        store.update((s) => { s.teams.U19.playingTime[t.dataset.id] = t.dataset.pt; });
        render();
      } else if (t.dataset.action === 'open-player') go('player', t.dataset.id);
      else if (t.dataset.action === 'auto') {
        store.update((s) => {
          const U19 = s.teams.U19;
          const { starters, bench } = autoLineup(U19.players.map((id) => s.players[id]), U19.formation, 5);
          for (const id of U19.players) U19.playingTime[id] = starters.includes(id) ? 'titulaire' : bench.includes(id) ? 'remplacant' : 'aucun';
        });
        toast('Temps de jeu réparti automatiquement');
        render();
      }
    });
    root.addEventListener('change', (e) => {
      const id = e.target.dataset.focus;
      if (!id) return;
      store.update((s) => { s.players[id].trainingFocus = e.target.value; });
      toast(`Axe : ${ATTR_LABELS[e.target.value]}`);
    });
  },
};
