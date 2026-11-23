import { esc, attrGauges, stars, ratingBadge, moraleIcon, evolutionChart, toast, gauge } from '../ui/components.js';
import { projectPlayer, currentPlayingTime } from '../engine/projection.js';
import { overall, fullName, ATTRS, ATTR_LABELS } from '../engine/players.js';
import { promoteToFirstTeam } from '../engine/week.js';
import { movePlayer } from '../engine/events.js';
import { cityById } from '../engine/setup.js';

const TEAM_LABEL = { A: 'Équipe 1', U19: 'U19', U17: 'U17 (simulé)', U15: 'U15 (simulé)', PROSPECT: 'Repéré (hors club)', PARTI: 'A quitté le club' };

export default {
  render({ store, data, param }) {
    const s = store.save;
    const p = s.players[param];
    if (!p) return '<p class="muted">Joueur introuvable.</p><a class="btn" href="#/u19">Retour</a>';
    const prospect = s.prospects.find((x) => x.playerId === p.id);
    const hidden = !!prospect?.partial;
    const city = p.originCity ? cityById(data, p.originCity) : null;
    const ovr = overall(p);
    const canTrain = ['U19', 'A'].includes(p.team) && !p.isReal;
    const back = p.team === 'A' ? '#/team' : p.team === 'PROSPECT' ? '#/map' : '#/u19';

    return `
      <a class="back" href="${back}">‹ Retour</a>
      <section class="card player-head">
        <div class="ph-badge">${hidden ? '<span class="rating r-ok big">?</span>' : ratingBadge(ovr, 'big')}</div>
        <div>
          <h2>${esc(fullName(p))}</h2>
          <p class="muted">${esc(p.position)} · ${p.age} ans · ${esc(TEAM_LABEL[p.team] || p.team)}</p>
          <p>${stars(p.potential, { hidden })} ${hidden ? '' : `<span class="small muted">potentiel ${p.potential}</span>`}</p>
          ${p.isReal ? `<p class="small muted">Joueur réel · ${p.ovrSource === 'ea-fc27' ? 'note EA SPORTS FC 27' : 'note estimée'}</p>` : ''}
          ${city ? `<p class="small">📍 Originaire de <b>${esc(city.name)}</b></p>` : ''}
        </div>
      </section>

      <section class="card">
        <h3>Attributs</h3>
        ${attrGauges(p, { hidden })}
        <p class="small muted">Barre claire = potentiel. Plus on s’en approche, plus la progression ralentit.</p>
      </section>

      <section class="card grid-2">
        ${gauge('Moral', p.morale)}
        ${gauge('Forme', p.fitness)}
        <div class="small">Minutes cette saison : <b>${p.minutesThisSeason}′</b></div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Évolution de la note</h3><span class="chip">${hidden ? '?' : ovr}</span></div>
        ${hidden ? '<p class="small muted">Attributs partiellement cachés : rencontrez sa famille pour en savoir plus.</p>' : evolution(s, p, ovr)}
      </section>

      ${canTrain ? `
      <section class="card">
        <h3>Axe d’entraînement</h3>
        <div class="seg wide" role="group">
          ${ATTRS.map((a) => `<button class="${p.trainingFocus === a ? 'on' : ''}" data-focus="${a}">${ATTR_LABELS[a]}</button>`).join('')}
        </div>
      </section>` : ''}

      <section class="actions">
        ${['U19', 'U17', 'U15'].includes(p.team) ? `<button class="btn btn-primary btn-big" data-action="promote">⬆ Faire monter en équipe 1</button>` : ''}
        ${p.team === 'U17' ? '<button class="btn" data-action="to-u19">Faire monter en U19</button>' : ''}
        ${p.team === 'A' && !p.isReal ? '<button class="btn" data-action="down">Renvoyer en U19</button>' : ''}
        ${prospect ? `<p class="small">Repéré à ${esc(cityById(data, prospect.cityId).name)}. Allez <a href="#/map">rencontrer ses parents</a> pour le faire venir au centre.</p>` : ''}
      </section>`;
  },

  bind(root, { store, render, param }) {
    root.addEventListener('click', (e) => {
      const f = e.target.closest('[data-focus]');
      if (f) {
        store.update((s) => { s.players[param].trainingFocus = f.dataset.focus; });
        toast(`Axe : ${ATTR_LABELS[f.dataset.focus]}`);
        render();
        return;
      }
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'promote') {
        const s = store.save;
        const p = s.players[param];
        const avg = s.teams.A.starters.reduce((t, id) => t + overall(s.players[id]), 0) / 11;
        const warn = overall(p) < avg - 10
          ? `\n\nAttention : sa note (${overall(p)}) est inférieure de plus de 10 points à celle des titulaires (${avg.toFixed(0)}). Il perdra 5 de moral par match joué.`
          : '';
        if (!confirm(`Faire monter ${fullName(p)} en équipe 1 ?${warn}`)) return;
        store.set(promoteToFirstTeam(s, param));
        toast(`${fullName(p)} rejoint l’équipe 1 ! 📖 Livre d’or`);
        render();
      } else if (a === 'to-u19' || a === 'down') {
        store.update((s) => movePlayer(s, param, 'U19'));
        toast('Transféré en U19');
        render();
      }
    });
  },
};

const PT_LABEL = { titulaire: 'titulaire', remplacant: 'remplaçant', aucun: 'sans temps de jeu' };

function evolution(s, p, ovr) {
  const hist = p.history || [];
  const seasons = new Set(hist.map((h) => Math.floor(h[0] / 100)));
  const real = hist.length ? hist.map((h) => ({ v: h[1] })) : [{ v: ovr }];
  const pt = currentPlayingTime(s, p);
  const weeksLeft = s.seasonOver ? 0 : 34 - s.week + 1;
  const proj = projectPlayer(p, { facilitiesLevel: s.facilities.terrains, playingTime: pt, weeksLeft })
    .map((x) => ({ v: x.ovr, label: `${x.age} ans` }));
  return `${evolutionChart({
    real, proj, potential: p.potential,
    realCaption: seasons.size > 1 ? 'Historique' : 'Saison en cours',
    projCaption: 'Projection 4 ans',
  })}
  <p class="small muted">Hypothèses : temps de jeu actuel (${PT_LABEL[pt]}), terrains niveau ${s.facilities.terrains}, entraînement équilibré, reste au club. Changez son temps de jeu ou son axe d’entraînement pour faire bouger la courbe.</p>`;
}
