import { esc, euro, openModal, closeModal, toast, playerRow, progressBar } from '../ui/components.js';
import {
  ACTIVITIES, PARENT_CHOICES, RECRUIT_ACTIVITIES, canDoActivity, doActivity, meetParents, missionDone,
  discoverCity, doMission, partnerMission, visitLandmark,
} from '../engine/activities.js';
import { streamFor } from '../engine/rng.js';
import { ensureCommunity } from '../engine/community.js';

let selectedCity = null;
let layers = { aja: true, partners: true };

const proj = ([lon, lat]) => [((lon - 2.8) * 225).toFixed(1), ((48.45 - lat) * 333).toFixed(1)];
const repColor = (r) => (r >= 80 ? 'var(--gold)' : r >= 50 ? 'var(--blue)' : r >= 30 ? 'var(--blue-mid)' : 'var(--blue-light)');
const repLabel = (r) => (r >= 80 ? 'L’Yonne vibre AJA : jeunes rares accessibles' : r >= 50 ? 'Bastion ajaïste : meilleurs jeunes, partenaires généreux' : r >= 30 ? 'L’AJA commence à rayonner' : 'L’AJA reste à faire connaître ici');

const STEPS = ['Découvrir', 'Mission', 'Recruter', 'Partenaire'];

export default {
  keepScroll: true,
  render({ store, data, param }) {
    const s = store.save;
    ensureCommunity(s);
    if (param && data.cities.cities.some((c) => c.id === param)) selectedCity = param;
    const cities = data.cities.cities;
    const outline = data.cities.outline.map(proj).map((p) => p.join(',')).join(' ');
    const river = (pts) => pts.map(proj).map((p) => p.join(',')).join(' ');
    const aux = data.cities.auxerre;
    const sel = selectedCity && cities.find((c) => c.id === selectedCity);
    const c = s.community;
    const missions = Object.keys(c.missionsDone).length;

    const svg = `
      <svg class="yonne" viewBox="0 0 360 400" role="img" aria-label="Carte de l’Yonne : 8 communes et les lieux de l’AJA">
        <polygon points="${outline}" class="dept"/>
        <polyline points="${river(data.cities.rivers.yonne)}" class="river"/>
        <polyline points="${river(data.cities.rivers.armancon)}" class="river"/>
        <g class="aux">
          <rect x="${aux.x - 7}" y="${aux.y - 7}" width="14" height="14" rx="3"/>
          <text x="${aux.x - 11}" y="${aux.y + 4}" text-anchor="end">Auxerre</text>
        </g>
        ${layers.aja ? data.territory.landmarks.map((l) => `
          <g class="landmark ${c.landmarksVisited.includes(l.id) ? 'seen' : ''}" data-landmark="${l.id}" tabindex="0" role="button" aria-label="${esc(l.name)}">
            <circle cx="${l.x}" cy="${l.y}" r="11"/>
            <text x="${l.x}" y="${l.y + 4}" text-anchor="middle">${l.icon}</text>
          </g>`).join('') : ''}
        ${cities.map((ct) => {
          const r = s.cities[ct.id].reputation;
          const prospects = s.prospects.filter((x) => x.cityId === ct.id).length;
          const done = missionDone(s, ct.id);
          const sp = data.sponsors.sponsors.find((x) => x.city === ct.id);
          const partner = layers.partners && sp && s.sponsors[sp.id].signed;
          return `
          <g class="city ${selectedCity === ct.id ? 'sel' : ''} ${done ? 'done' : ''}" data-city="${ct.id}" tabindex="0" role="button" aria-label="${esc(ct.name)}, rayonnement ${r}${done ? ', mission accomplie' : ''}">
            <circle cx="${ct.x}" cy="${ct.y}" r="22" class="hit"/>
            <circle cx="${ct.x}" cy="${ct.y}" r="${9 + r / 12}" fill="${repColor(r)}" class="dot"/>
            <text ${ct.label === 'left' ? `x="${ct.x - 12 - r / 12}" y="${ct.y + 4}" text-anchor="end"` : ct.label === 'right' ? `x="${ct.x + 12 + r / 12}" y="${ct.y + 4}" text-anchor="start"` : ct.label === 'below' ? `x="${ct.x}" y="${ct.y + 22 + r / 12}" text-anchor="middle"` : `x="${ct.x}" y="${ct.y - 14 - r / 12}" text-anchor="middle"`} class="lbl">${esc(ct.name)}${ct.id === c.homeCity ? ' ♥' : ''}</text>
            <text x="${ct.x}" y="${ct.y + 4}" text-anchor="middle" class="rep">${done ? '✓' : r}</text>
            ${prospects ? `<circle cx="${ct.x + 12}" cy="${ct.y - 10}" r="7" class="pin"/><text x="${ct.x + 12}" y="${ct.y - 7}" text-anchor="middle" class="pin-t">${prospects}</text>` : ''}
            ${partner ? `<text x="${ct.x - 15}" y="${ct.y + 18}" class="partner-i">💼</text>` : ''}
          </g>`;
        }).join('')}
      </svg>`;

    let panel = '<p class="hint center">Touchez une commune pour la découvrir, puis relevez sa mission pour gagner la confiance des clubs locaux.</p>';
    if (sel) {
      const t = data.territory.communes[sel.id];
      const r = s.cities[sel.id].reputation;
      const done = missionDone(s, sel.id);
      const sponsorDef = data.sponsors.sponsors.find((x) => x.city === sel.id);
      const st = sponsorDef && s.sponsors[sponsorDef.id];
      const partnerMet = sponsorDef && c.partnersMet.includes(sponsorDef.id);
      const prospects = s.prospects.filter((x) => x.cityId === sel.id).map((x) => ({ ...x, p: s.players[x.playerId] }));
      const step = !done ? 1 : !partnerMet && st?.signed ? 3 : 2;
      const activity = (a) => {
        const def = ACTIVITIES[a];
        const ok = canDoActivity(s, sel.id, a);
        return `<button class="act" data-act="${a}" ${ok.ok ? '' : 'disabled'}>
          <span class="act-i">${def.icon}</span><span><b>${def.label}</b><br><span class="small muted">${ok.ok ? def.desc : esc(ok.reason)}</span></span></button>`;
      };
      panel = `
        <section class="card city-panel">
          <div class="card-head"><h3>${esc(sel.name)}${sel.id === c.homeCity ? ' <span class="heart">♥</span>' : ''}</h3><span class="chip">Rayonnement ${r}/100</span></div>
          <p class="eyebrow">${esc(t.tagline)}</p>
          <ol class="steps">${STEPS.map((x, i) => `<li class="${i < step ? 'ok' : i === step ? 'now' : ''}">${x}</li>`).join('')}</ol>
          <p>${esc(t.intro)}</p>
          <div class="rep-bar"><div style="width:${r}%;background:${repColor(r)}"></div></div>
          <p class="small muted">${repLabel(r)}</p>

          <h4>1 · Mission : ${esc(t.mission.title)}</h4>
          ${done
            ? `<p class="small ok">✓ Mission accomplie — les clubs de ${esc(sel.name)} vous font confiance.</p>`
            : `<p class="small">${esc(t.mission.setup)}</p>
               <button class="btn btn-primary" data-mission ${s.travelPointsLeft < 1 ? 'disabled' : ''}>Relever la mission (1 🚗)</button>
               ${s.travelPointsLeft < 1 ? '<p class="small muted">Plus de déplacement cette semaine.</p>' : ''}`}

          <h4>2 · Recruter pour le centre</h4>
          <div class="activities">${RECRUIT_ACTIVITIES.map(activity).join('')}</div>
          ${prospects.length ? `<p class="small"><b>Jeunes repérés ici</b></p><div class="list">${prospects.map((x) => playerRow(x.p, { hidden: x.partial })).join('')}</div>` : ''}

          <h4>3 · Partenaires et vie locale</h4>
          ${sponsorDef ? `
            <div class="partner-card">
              <div><b>${esc(sponsorDef.name)}</b> <span class="tag-fict">fictif</span><br>
              <span class="small muted">${esc(sponsorDef.category)} · ${st.signed ? `partenaire (${euro(st.budget)}/saison, satisfaction ${st.satisfaction})` : 'pas encore partenaire'}</span></div>
              ${st.signed && !partnerMet ? `<button class="btn btn-small" data-partner="${sponsorDef.id}" ${s.travelPointsLeft < 1 ? 'disabled' : ''}>Découvrir (1 🚗)</button>` : partnerMet ? '<span class="small ok">✓ Découvert</span>' : ''}
            </div>` : ''}
          <div class="activities">${['sponsor', 'gala'].map(activity).join('')}</div>
        </section>`;
    }

    const ranking = cities.slice().sort((a, b) => s.cities[b.id].reputation - s.cities[a.id].reputation);
    return `
      <div class="card row-between">
        <div><b>L’Yonne, terre de l’AJA</b><br><span class="small muted">${missions}/8 missions · ${s.prospects.length} jeune(s) repéré(s)</span></div>
        <div class="tp" aria-label="${s.travelPointsLeft} déplacement(s) restant(s)">${'🚗'.repeat(s.travelPointsLeft)}</div>
      </div>
      <div class="layer-toggles" role="group" aria-label="Calques de la carte">
        <button class="${layers.aja ? 'on' : ''}" data-layer="aja">🏟️ Lieux de l’AJA</button>
        <button class="${layers.partners ? 'on' : ''}" data-layer="partners">💼 Partenaires</button>
      </div>
      <div class="map-wrap">${svg}</div>
      <div class="legend small">
        <span><i style="background:var(--blue-light)"></i>&lt;30</span><span><i style="background:var(--blue-mid)"></i>30+</span>
        <span><i style="background:var(--blue)"></i>50+</span><span><i style="background:var(--gold)"></i>80+</span><span>✓ mission</span>
      </div>
      ${panel}
      <section class="card">
        <div class="card-head"><h3>Rayonnement des communes</h3><span class="chip">${missions}/8</span></div>
        ${progressBar(missions, 8)}
        <ol class="ranking">${ranking.map((ct, i) => `
          <li class="${ct.id === c.homeCity ? 'me' : ''}"><span>${i + 1}</span><button class="linkish" data-city="${ct.id}">${esc(ct.name)}${ct.id === c.homeCity ? ' ♥' : ''}</button>
          ${missionDone(s, ct.id) ? '<span class="ok">✓</span>' : '<span class="muted">·</span>'}<b>${s.cities[ct.id].reputation}</b></li>`).join('')}</ol>
        <p class="small muted">Objectif collectif : la mission dans les 8 communes. Votre commune de cœur (♥, à choisir dans l’espace Supporter) rayonne 50 % plus vite.</p>
      </section>`;
  },

  bind(root, { store, data, render, go }) {
    const pickCity = (id) => {
      selectedCity = id;
      const { save, xp } = discoverCity(store.save, id);
      if (xp) store.set(save);
      if (location.hash !== `#/map/${id}`) history.replaceState(null, '', `#/map/${id}`);
      render();
      root.querySelector('.city-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    root.addEventListener('click', (e) => {
      const lay = e.target.closest('[data-layer]');
      if (lay) { layers[lay.dataset.layer] = !layers[lay.dataset.layer]; return render(); }
      const lm = e.target.closest('[data-landmark]');
      if (lm) return showLandmark(store, data, lm.dataset.landmark, render);
      const c = e.target.closest('[data-city]');
      if (c) return pickCity(c.dataset.city);
      const pl = e.target.closest('[data-action="open-player"]');
      if (pl) return go('player', pl.dataset.id);
      if (e.target.closest('[data-mission]')) return missionDialog(store, data, selectedCity, render);
      const pa = e.target.closest('[data-partner]');
      if (pa) {
        const { save, result } = partnerMission(store.save, data, pa.dataset.partner);
        if (result.error) return toast(result.error);
        store.set(save);
        render();
        return showResult(result, save);
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const activity = act.dataset.act;
      const s = store.save;
      if (activity === 'parents') return parentsDialog(store, data, selectedCity, render);
      const rng = streamFor(s, 'act', selectedCity, activity, s.travelPointsLeft, s.prospects.length);
      const { save, result } = doActivity(s, data, selectedCity, activity, rng);
      if (result.error) return toast(result.error);
      store.set(save);
      render();
      showResult(result, save);
    });
    root.addEventListener('keydown', (e) => {
      const c = e.target.closest('[data-city],[data-landmark]');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
  },
};

function showLandmark(store, data, id, render) {
  const l = data.territory.landmarks.find((x) => x.id === id);
  const { save, xp } = visitLandmark(store.save, id);
  if (xp) { store.set(save); render(); }
  openModal(`
    <div class="modal-head"><h3>${l.icon} ${esc(l.name)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p>${esc(l.text)}</p>
    ${xp ? `<p class="small ok">Lieu découvert · +${xp} XP</p>` : ''}
    <button class="btn btn-primary" data-close>OK</button>`);
}

function showResult(result, save) {
  openModal(`
    <div class="modal-head"><h3>${esc(result.title)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    ${result.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    ${result.revealed?.length ? `<div class="list">${result.revealed.map((id) => {
      const pr = save.prospects.find((x) => x.playerId === id);
      return playerRow(save.players[id], { hidden: pr?.partial });
    }).join('')}</div><p class="small muted">Rencontrez leurs parents pour les faire venir au centre.</p>` : ''}
    ${result.xp ? `<p class="small ok">+${result.xp} XP supporter</p>` : ''}
    <button class="btn btn-primary" data-close>OK</button>`, {
    onBind(m) {
      m.addEventListener('click', (e) => {
        const pl = e.target.closest('[data-action="open-player"]');
        if (pl) { closeModal(); location.hash = `#/player/${pl.dataset.id}`; }
      });
    },
  });
}

function missionDialog(store, data, cityId, render) {
  const city = data.cities.cities.find((x) => x.id === cityId);
  const m = data.territory.communes[cityId].mission;
  openModal(`
    <div class="modal-head"><h3>📍 ${esc(m.title)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p class="small muted">${esc(city.name)}</p>
    <p>${esc(m.setup)}</p>
    <p><b>${esc(m.question)}</b></p>
    <div class="choices col">${m.choices.map((ch, i) => `<button class="btn" data-answer="${i}">${esc(ch)}</button>`).join('')}</div>`, {
    onBind(el) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-answer]');
        if (!b) return;
        const { save, result } = doMission(store.save, data, cityId, Number(b.dataset.answer));
        if (result.error) { closeModal(); return toast(result.error); }
        store.set(save);
        render();
        el.innerHTML = `
          <div class="modal-head"><h3>${result.success ? '✅ Mission accomplie !' : '🤔 Pas cette fois…'}</h3></div>
          ${result.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          <p class="small ok">+${result.xp} XP supporter</p>
          <button class="btn btn-primary" data-close>${result.success ? 'Recruter dans la commune' : 'OK'}</button>`;
      });
    },
  });
}

function parentsDialog(store, data, cityId, render) {
  const s = store.save;
  const list = s.prospects.filter((x) => x.cityId === cityId);
  openModal(`
    <div class="modal-head"><h3>Rencontrer les parents</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p>Quelle famille voulez-vous rencontrer ?</p>
    <div class="list">${list.map((x) => playerRow(s.players[x.playerId], { action: 'pick', hidden: x.partial })).join('')}</div>`, {
    onBind(m) {
      m.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-action="pick"]');
        if (pick) {
          const p = s.players[pick.dataset.id];
          m.innerHTML = `
            <div class="modal-head"><h3>Chez les ${esc(p.lastName)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
            <p>« Bonjour… Alors comme ça, l’AJA s’intéresse à ${esc(p.firstName)} ? Qu’est-ce que vous pouvez lui offrir ? »</p>
            <div class="choices col">${Object.entries(PARENT_CHOICES).map(([k, c]) => `<button class="btn" data-choice="${k}" data-id="${p.id}">${esc(c.label)}</button>`).join('')}</div>`;
          return;
        }
        const ch = e.target.closest('[data-choice]');
        if (ch) {
          const rng = streamFor(store.save, 'parents', ch.dataset.id, ch.dataset.choice);
          const { save, result } = meetParents(store.save, data, ch.dataset.id, ch.dataset.choice, rng);
          if (result.error) { closeModal(); return toast(result.error); }
          store.set(save);
          render();
          m.innerHTML = `
            <div class="modal-head"><h3>${result.success ? '✅ Accord trouvé !' : '🤔 Pas encore…'}</h3></div>
            ${result.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
            <p class="small ok">+${result.xp} XP supporter</p>
            <button class="btn btn-primary" data-close>OK</button>`;
        }
      });
    },
  });
}
