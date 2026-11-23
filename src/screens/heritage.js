// Patrimoine : histoire de l'AJA, grandes époques (missions historiques), moments, figures, centre de formation.
import { esc, openModal, toast, progressBar } from '../ui/components.js';
import { ensureCommunity, answerHeritage, eraComplete, recordEvent } from '../engine/community.js';
import { cityById } from '../engine/setup.js';
import { overall } from '../engine/players.js';

let tab = 'epoques';

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    ensureCommunity(s);
    const h = data.heritage;
    const c = s.community;
    const done = h.eras.filter((e) => eraComplete(s, e)).length;

    const eras = h.eras.map((e, i) => {
      const complete = eraComplete(s, e);
      const good = e.quiz.filter((q) => c.heritage.answered[q] === true).length;
      const read = c.heritage.erasRead.includes(e.id);
      return `
        <article class="era ${complete ? 'complete' : ''}">
          <div class="era-line"><span class="era-dot">${complete ? e.reward.icon : i + 1}</span></div>
          <div class="era-body card">
            <p class="eyebrow">${esc(e.years)}</p>
            <h3>${esc(e.title)}</h3>
            <p class="era-text ${read ? '' : 'clamp'}">${esc(e.text)}</p>
            ${read ? '' : `<button class="linkish small" data-read="${e.id}">Lire la suite (+10 XP)</button>`}
            <div class="era-foot">
              <span class="small">${complete ? `🎁 <b>${esc(e.reward.item)}</b> débloqué` : `Mission historique : ${good}/${e.quiz.length}`}</span>
              ${complete ? '' : `<button class="btn btn-small btn-primary" data-era="${e.id}">${good ? 'Continuer' : 'Relever'}</button>`}
            </div>
          </div>
        </article>`;
    }).join('');

    const moments = `<ol class="timeline">${h.moments.map((m) => `
      <li><span class="tl-year">${m.year}</span><div><b>${esc(m.title)}</b><br><span class="small muted">${esc(m.text)}</span></div></li>`).join('')}</ol>`;

    const figures = `<div class="figures">${h.figures.map((f) => `
      <div class="figure card"><span class="fig-i">${f.icon}</span><b>${esc(f.name)}</b><span class="small eyebrow">${esc(f.role)}</span><span class="small">${esc(f.text)}</span></div>`).join('')}</div>`;

    const alumni = s.goldenBook.slice().reverse().map((g) => {
      const p = s.players[g.playerId];
      const city = g.originCity ? cityById(data, g.originCity) : null;
      return `<a class="supporter-alumni-row" href="#/player/${encodeURIComponent(g.playerId)}">
        <span class="supporter-alumni-icon">${g.established ? '⭐' : '📖'}</span>
        <span><b>${esc(g.name)}</b><small>Depuis les ${esc(g.from)} · ${esc(g.season)}${city ? ` · ${esc(city.name)}` : ''}${g.established ? ' · installé en équipe 1' : ''}</small></span>
        <strong>${p ? overall(p) : g.ovr}</strong></a>`;
    }).join('');

    const formation = `
      <section class="card">
        <h3>🌱 Le centre de formation</h3>
        <p>${esc(h.academy)}</p>
      </section>
      <section class="card">
        <div class="card-head"><h3>📖 Le livre d’or de votre centre</h3><span class="chip">${s.goldenBook.length}</span></div>
        <p class="small muted">Les jeunes que vous avez fait monter. ⭐ = installé en équipe 1 (270 minutes jouées).</p>
        ${alumni ? `<div class="supporter-alumni">${alumni}</div>` : '<p class="small muted">Votre premier formé apparaîtra ici. Ouvrez la fiche d’un U19 et faites-le monter en équipe 1.</p>'}
      </section>`;

    const views = { epoques: `<div class="eras">${eras}</div>`, moments: `<section class="card">${moments}</section>`, figures, formation };
    const tabs = { epoques: 'Époques', moments: 'Moments', figures: 'Figures', formation: 'Formation' };

    return `
      <section class="heritage-hero">
        <p class="eyebrow">Depuis 1905</p>
        <h2>L’histoire de l’AJA</h2>
        <p>De l’abbé Deschamps aux nuits européennes : traversez les époques, relevez les missions historiques et débloquez la collection du club.</p>
        <div class="hh-progress"><span>${done}/${h.eras.length} époques</span>${progressBar(done, h.eras.length)}</div>
      </section>
      <div class="tabs-inline" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${views[tab]}
      ${c.heritage.items.length ? `<section class="card"><h3>Votre collection</h3><div class="collection">${h.eras.filter((e) => c.heritage.items.includes(e.id)).map((e) => `<span>${e.reward.icon} ${esc(e.reward.item)}</span>`).join('')}</div></section>` : ''}
      <p class="small muted">Contenus rédigés pour le prototype à partir de faits publics, à enrichir et valider avec le club (archives, photos, témoignages).</p>`;
  },

  bind(root, { store, data, render }) {
    // Consulter le patrimoine compte pour l'objectif hebdomadaire « Transmettre la mémoire »
    if (!store.save.community.weekly.heritage) store.set(recordEvent(store.save, 'heritageView'));
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; return render(); }
      const r = e.target.closest('[data-read]');
      if (r) {
        store.set(recordEvent(store.save, 'heritageRead', { eraId: r.dataset.read }));
        toast('+10 XP');
        return render();
      }
      const era = e.target.closest('[data-era]');
      if (era) eraQuiz(store, data, era.dataset.era, render);
    });
  },
};

function eraQuiz(store, data, eraId, render) {
  const h = data.heritage;
  const era = h.eras.find((x) => x.id === eraId);
  const nextQ = () => era.quiz.find((q) => store.save.community.heritage.answered[q] !== true);
  const ask = (el) => {
    const qid = nextQ();
    const q = h.questions[qid];
    const idx = era.quiz.indexOf(qid) + 1;
    el.innerHTML = `
      <div class="modal-head"><h3>${esc(era.title)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
      <p class="eyebrow">Mission historique · question ${idx}/${era.quiz.length}</p>
      <p><b>${esc(q.q)}</b></p>
      <div class="choices col">${q.choices.map((ch, i) => `<button class="btn" data-a="${i}" data-q="${qid}">${esc(ch)}</button>`).join('')}</div>`;
  };
  openModal('<div></div>', {
    onBind(el) {
      ask(el);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (b) {
          const qid = b.dataset.q;
          const res = answerHeritage(store.save, h, eraId, qid, Number(b.dataset.a));
          store.set(res.save);
          render();
          const q = h.questions[qid];
          const more = nextQ();
          el.innerHTML = `
            <div class="modal-head"><h3>${res.correct ? '✅ Exact !' : '❌ Raté'}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
            ${res.correct ? '' : `<p>La bonne réponse : <b>${esc(q.choices[q.answer])}</b>. Vous pourrez retenter la question.</p>`}
            ${res.unlocked ? `<div class="unlock"><span>${res.unlocked.icon}</span><b>${esc(res.unlocked.item)}</b><span class="small">ajouté à votre collection · un mécène offre 1 500 € au centre · +2 de rayonnement dans toute l’Yonne</span></div>` : ''}
            <div class="choices">${more && res.correct ? '<button class="btn btn-primary" data-next>Question suivante</button>' : ''}
            ${more && !res.correct ? '<button class="btn btn-primary" data-next>Réessayer</button>' : ''}
            <button class="btn" data-close>Fermer</button></div>`;
          return;
        }
        if (e.target.closest('[data-next]')) ask(el);
      });
    },
  });
}
