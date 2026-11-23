import { esc, euro, openModal, closeModal, toast, playerRow } from '../ui/components.js';
import { ACTIVITIES, PARENT_CHOICES, canDoActivity, doActivity, meetParents } from '../engine/activities.js';
import { streamFor } from '../engine/rng.js';
import { fullName } from '../engine/players.js';
import { awardCommunity } from '../engine/community.js';

let selectedCity = null;

const proj = ([lon, lat]) => [((lon - 2.8) * 225).toFixed(1), ((48.45 - lat) * 333).toFixed(1)];
const repColor = (r) => (r >= 80 ? 'var(--gold)' : r >= 50 ? 'var(--blue)' : r >= 30 ? 'var(--blue-mid)' : 'var(--blue-light)');
const repLabel = (r) => (r >= 80 ? 'Jeunes rares accessibles' : r >= 50 ? 'Meilleurs jeunes, sponsors généreux' : r >= 30 ? 'On commence à vous connaître' : 'Peu connu');

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    const cities = data.cities.cities;
    const outline = data.cities.outline.map(proj).map((p) => p.join(',')).join(' ');
    const river = (pts) => pts.map(proj).map((p) => p.join(',')).join(' ');
    const aux = data.cities.auxerre;
    const sel = selectedCity && cities.find((c) => c.id === selectedCity);

    const svg = `
      <svg class="yonne" viewBox="0 0 360 400" role="img" aria-label="Carte de l’Yonne et de ses 8 villes">
        <polygon points="${outline}" class="dept"/>
        <polyline points="${river(data.cities.rivers.yonne)}" class="river"/>
        <polyline points="${river(data.cities.rivers.armancon)}" class="river"/>
        <g class="aux">
          <rect x="${aux.x - 7}" y="${aux.y - 7}" width="14" height="14" rx="3"/>
          <text x="${aux.x}" y="${aux.y + 22}" text-anchor="middle">Auxerre</text>
        </g>
        ${cities.map((c) => {
          const r = s.cities[c.id].reputation;
          const prospects = s.prospects.filter((x) => x.cityId === c.id).length;
          return `
          <g class="city ${selectedCity === c.id ? 'sel' : ''}" data-city="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}, réputation ${r}">
            <circle cx="${c.x}" cy="${c.y}" r="22" class="hit"/>
            <circle cx="${c.x}" cy="${c.y}" r="${9 + r / 12}" fill="${repColor(r)}" class="dot"/>
            <text x="${c.x}" y="${c.y - 14 - r / 12}" text-anchor="middle" class="lbl">${esc(c.name)}</text>
            <text x="${c.x}" y="${c.y + 4}" text-anchor="middle" class="rep">${r}</text>
            ${prospects ? `<circle cx="${c.x + 12}" cy="${c.y - 10}" r="7" class="pin"/><text x="${c.x + 12}" y="${c.y - 7}" text-anchor="middle" class="pin-t">${prospects}</text>` : ''}
          </g>`;
        }).join('')}
      </svg>`;

    let panel = '<p class="hint center">Touchez une ville pour vous y rendre. Chaque activité coûte 1 point de déplacement.</p>';
    if (sel) {
      const r = s.cities[sel.id].reputation;
      const sponsorDef = data.sponsors.sponsors.find((x) => x.city === sel.id);
      const st = sponsorDef && s.sponsors[sponsorDef.id];
      const prospects = s.prospects.filter((x) => x.cityId === sel.id).map((x) => ({ ...x, p: s.players[x.playerId] }));
      panel = `
        <section class="card city-panel">
          <div class="card-head"><h3>${esc(sel.name)}</h3><span class="chip">Réputation ${r}/100</span></div>
          <div class="rep-bar"><div style="width:${r}%;background:${repColor(r)}"></div></div>
          <p class="small muted">${repLabel(r)}</p>
          ${sponsorDef ? `<p class="small">💼 ${esc(sponsorDef.name)} : ${st.signed ? `partenaire (${euro(st.budget)}/saison, satisfaction ${st.satisfaction})` : 'pas encore partenaire'}</p>` : ''}
          <div class="activities">
            ${sel.activities.map((a) => {
              const def = ACTIVITIES[a];
              const ok = canDoActivity(s, sel.id, a);
              return `<button class="act" data-act="${a}" ${ok.ok ? '' : 'disabled'} title="${esc(ok.reason || '')}">
                <span class="act-i">${def.icon}</span><span><b>${def.label}</b><br><span class="small muted">${ok.ok ? def.desc : esc(ok.reason)}</span></span></button>`;
            }).join('')}
          </div>
          ${prospects.length ? `<h4>Jeunes repérés ici</h4><div class="list">${prospects.map((x) => playerRow(x.p, { hidden: x.partial })).join('')}</div>` : ''}
        </section>`;
    }

    return `
      <div class="card row-between">
        <div><b>Carte de l’Yonne</b><br><span class="small muted">Semaine ${s.week} · ${s.prospects.length} jeune(s) repéré(s)</span></div>
        <div class="tp">${'🚗'.repeat(s.travelPointsLeft)}${'<span class="muted">○</span>'.repeat(Math.max(0, 2 - s.travelPointsLeft))}</div>
      </div>
      <div class="map-wrap">${svg}</div>
      <div class="legend small">
        <span><i style="background:var(--blue-light)"></i>&lt;30</span><span><i style="background:var(--blue-mid)"></i>30+</span>
        <span><i style="background:var(--blue)"></i>50+</span><span><i style="background:var(--gold)"></i>80+</span>
      </div>
      ${panel}`;
  },

  bind(root, { store, data, render, go }) {
    const pickCity = (id) => { selectedCity = id; render(); root.querySelector('.city-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    root.addEventListener('click', (e) => {
      const c = e.target.closest('[data-city]');
      if (c) return pickCity(c.dataset.city);
      const pl = e.target.closest('[data-action="open-player"]');
      if (pl) return go('player', pl.dataset.id);
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const activity = act.dataset.act;
      const s = store.save;
      if (activity === 'parents') return parentsDialog(store, data, selectedCity, render);
      const rng = streamFor(s, 'act', selectedCity, activity, s.travelPointsLeft, s.prospects.length);
      const { save, result } = doActivity(s, data, selectedCity, activity, rng);
      if (result.error) return toast(result.error);
      awardCommunity(save, 15, { activity: true, cityId: selectedCity });
      store.set(save);
      render();
      showResult(result, save);
    });
    root.addEventListener('keydown', (e) => {
      const c = e.target.closest('[data-city]');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickCity(c.dataset.city); }
    });
  },
};

function showResult(result, save) {
  openModal(`
    <div class="modal-head"><h3>${esc(result.title)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    ${result.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    ${result.revealed?.length ? `<div class="list">${result.revealed.map((id) => {
      const pr = save.prospects.find((x) => x.playerId === id);
      return playerRow(save.players[id], { hidden: pr?.partial });
    }).join('')}</div><p class="small muted">Rencontrez leurs parents pour les faire venir au centre.</p>` : ''}
    <button class="btn btn-primary" data-close>OK</button>`, {
    onBind(m) {
      m.addEventListener('click', (e) => {
        const pl = e.target.closest('[data-action="open-player"]');
        if (pl) { closeModal(); location.hash = `#/player/${pl.dataset.id}`; }
      });
    },
  });
}

function parentsDialog(store, data, cityId, render) {
  const s = store.save;
  const list = s.prospects.filter((x) => x.cityId === cityId);
  const step1 = `
    <div class="modal-head"><h3>Rencontrer les parents</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p>Quelle famille voulez-vous rencontrer ?</p>
    <div class="list">${list.map((x) => playerRow(s.players[x.playerId], { action: 'pick', hidden: x.partial })).join('')}</div>`;
  openModal(step1, {
    onBind(m) {
      m.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-action="pick"]');
        if (pick) {
          const p = s.players[pick.dataset.id];
          m.innerHTML = `
            <div class="modal-head"><h3>Chez les ${esc(p.lastName)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
            <p>« Bonjour… Alors comme ça, l’AJA s’intéresse à ${esc(p.firstName)} ? Qu’est-ce que vous pouvez lui offrir ? »</p>
            <div class="choices">${Object.entries(PARENT_CHOICES).map(([k, c]) => `<button class="btn" data-choice="${k}" data-id="${p.id}">${esc(c.label)}</button>`).join('')}</div>`;
          return;
        }
        const ch = e.target.closest('[data-choice]');
        if (ch) {
          const rng = streamFor(store.save, 'parents', ch.dataset.id, ch.dataset.choice);
          const { save, result } = meetParents(store.save, data, ch.dataset.id, ch.dataset.choice, rng);
          if (result.error) { closeModal(); return toast(result.error); }
          if (result.success) awardCommunity(save, 30, { recruit: true });
          store.set(save);
          render();
          m.innerHTML = `
            <div class="modal-head"><h3>${result.success ? '✅ Accord trouvé !' : '🤔 Pas encore…'}</h3></div>
            ${result.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
            <button class="btn btn-primary" data-close>OK</button>`;
        }
      });
    },
  });
}
