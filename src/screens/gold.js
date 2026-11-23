import { esc } from '../ui/components.js';
import { cityById } from '../engine/setup.js';
import { overall } from '../engine/players.js';
import { recordEvent } from '../engine/community.js';

export default {
  render({ store, data }) {
    const s = store.save;
    const items = s.goldenBook.slice().reverse().map((g) => {
      const p = s.players[g.playerId];
      const city = g.originCity ? cityById(data, g.originCity) : null;
      return `
        <a class="card gold-item" href="#/player/${g.playerId}">
          <span class="gold-i">📖</span>
          <div><b>${esc(g.name)}</b><br>
          <span class="small muted">Monté en équipe 1 depuis les ${esc(g.from)} · ${esc(g.season)}, semaine ${g.week}${city ? ` · ${esc(city.name)}` : ''}</span><br>
          <span class="small">Note à la montée : ${g.ovr}${p ? ` · aujourd’hui : ${overall(p)}` : ''}</span></div>
        </a>`;
    }).join('');
    return `
      <a class="back" href="#/heritage">‹ Patrimoine</a>
      <h2 class="section-title">Livre d’or du centre</h2>
      ${items || '<p class="card muted">Aucun jeune n’est encore monté en équipe 1. Ouvrez la fiche d’un U19 et touchez « Faire monter en équipe 1 ».</p>'}`;
  },
  bind(root, { store }) {
    // Consulter le livre d'or compte pour l'objectif hebdomadaire « Transmettre la mémoire » (bug corrigé)
    if (!store.save.community.weekly.heritage) store.set(recordEvent(store.save, 'heritageView'));
  },
};
