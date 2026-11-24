// Musée de l'AJA : époques (missions historiques), matchs, trophées, légendes, archives, collection, quiz, formation.
import { esc, openModal, toast, progressBar } from '../ui/components.js';
import { ensureCommunity, answerHeritage, eraComplete, recordEvent, isoDay } from '../engine/community.js';
import {
  allCards, RARITY, weeklyQuiz, answerWeekly, archiveUnlocked, unlockHint, grantEraCards, answerMatchQuiz,
} from '../engine/collection.js';
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

    const views = {
      epoques: `<div class="eras">${eras}</div><section class="card"><h3>Chronologie</h3>${moments}</section>`,
      matchs: matchesView(s, data), trophees: trophiesView(data), figures, archives: archivesView(s, data),
      collection: collectionView(s, data), quiz: quizView(s, data), formation,
    };
    const tabs = { epoques: 'Époques', matchs: 'Matchs', trophees: 'Trophées', figures: 'Légendes', archives: 'Archives', collection: 'Collection', quiz: 'Quiz', formation: 'Formation' };
    const nCards = s.collection?.cards?.length || 0;

    return `
      <section class="heritage-hero">
        <p class="eyebrow">Musée de l’AJA · depuis 1905</p>
        <h2>L’histoire de l’AJA</h2>
        <p>De l’abbé Deschamps aux nuits européennes : relevez les missions historiques, répondez au quiz de la semaine et complétez votre collection.</p>
        <div class="hh-progress"><span>${done}/${h.eras.length} époques</span>${progressBar(done, h.eras.length)}</div>
        <div class="hh-progress"><span>${nCards}/${allCards(data).length} cartes</span>${progressBar(nCards, allCards(data).length)}</div>
      </section>
      <div class="chips" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${views[tab]}
      ${c.heritage.items.length ? `<section class="card"><h3>Votre collection</h3><div class="collection">${h.eras.filter((e) => c.heritage.items.includes(e.id)).map((e) => `<span>${e.reward.icon} ${esc(e.reward.item)}</span>`).join('')}</div></section>` : ''}
      <p class="small muted">Contenus rédigés pour le prototype à partir de faits publics, sans photos ni logos : les visuels et archives officiels nécessitent l’autorisation du club et des ayants droit.</p>`;
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
      if (era) return eraQuiz(store, data, era.dataset.era, render);
      const card = e.target.closest('[data-card]');
      if (card) return showCard(data, card.dataset.card, store.save);
      const mq = e.target.closest('[data-match]');
      if (mq) return matchQuiz(store, data, mq.dataset.match, render);
      const wq = e.target.closest('[data-wq]');
      if (wq) {
        const r = answerWeekly(store.save, data, isoDay(), wq.dataset.wq, Number(wq.dataset.a));
        if (r.error) return toast(r.error);
        store.set(r.save);
        toast(r.correct ? 'Bonne réponse ! +25 XP' : 'Raté…');
        if (r.reward) showReward(r.reward);
        return render();
      }
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
          store.set(res.unlocked ? grantEraCards(res.save, data, eraId).save : res.save);
          render();
          const q = h.questions[qid];
          const more = nextQ();
          el.innerHTML = `
            <div class="modal-head"><h3>${res.correct ? '✅ Exact !' : '❌ Raté'}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
            ${res.correct ? '' : `<p>La bonne réponse : <b>${esc(q.choices[q.answer])}</b>. Vous pourrez retenter la question.</p>`}
            ${res.unlocked ? `<p class="small ok">🃏 Cartes de l’époque ajoutées à votre collection.</p><div class="unlock"><span>${res.unlocked.icon}</span><b>${esc(res.unlocked.item)}</b><span class="small">ajouté à votre collection · un mécène offre 1 500 € au centre · +2 de rayonnement dans toute l’Yonne</span></div>` : ''}
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

// --- Vues du musée -------------------------------------------------------------
function matchesView(s, data) {
  const owned = new Set(s.collection?.cards || []);
  return data.museum.matches.map((m) => `
    <section class="card match-hist ${owned.has(`match-${m.id}`) ? 'won' : ''}">
      <p class="eyebrow">${m.year} · ${esc(m.title)}</p>
      <h3>${esc(m.score)}</h3>
      <p class="small">${esc(m.text)}</p>
      ${owned.has(`match-${m.id}`) ? '<p class="small ok">🃏 Carte obtenue</p>' : `<button class="btn btn-small" data-match="${m.id}">Question souvenir → carte du match</button>`}
    </section>`).join('');
}

function trophiesView(data) {
  const m = data.museum;
  return `
    <section class="card"><h3>Palmarès</h3>
      <div class="trophy-wall">${m.trophies.map((t) => `<div class="trophy"><span>${t.icon}</span><b>${esc(t.title)}</b><small>${esc(t.years)}</small><p class="small muted">${esc(t.text)}</p></div>`).join('')}</div>
    </section>
    <section class="card"><h3>Distinctions</h3>
      <ul class="dist">${m.distinctions.map((d) => `<li><span>${d.icon}</span><div><b>${esc(d.title)}</b><br><span class="small muted">${esc(d.text)}</span></div></li>`).join('')}</ul>
    </section>`;
}

function archivesView(s, data) {
  return data.museum.archives.map((a) => {
    const open = archiveUnlocked(s, data, a);
    return `<section class="card archive ${open ? '' : 'locked'}">
      <h3>${open ? '📂' : '🔒'} ${esc(a.title)}</h3>
      ${open ? `<p>${esc(a.text)}</p>` : `<p class="small muted">${esc(unlockHint(a))}</p>`}
    </section>`;
  }).join('');
}

function collectionView(s, data) {
  const cards = allCards(data);
  const owned = new Set(s.collection?.cards || []);
  const types = [...new Set(cards.map((c) => c.type))];
  return `
    <p class="hint">Gagnez des cartes avec la carte du jour (accueil), le quiz de la semaine, les missions des communes, les époques et les matchs historiques. Un doublon rapporte de l’XP.</p>
    ${types.map((t) => {
      const list = cards.filter((c) => c.type === t);
      return `<h3 class="section-title">${esc(t)}s · ${list.filter((c) => owned.has(c.id)).length}/${list.length}</h3>
      <div class="card-grid">${list.map((c) => owned.has(c.id)
        ? `<button class="coll-card r-${c.rarity}" data-card="${c.id}"><span class="cc-i">${c.icon}</span><b>${esc(c.title)}</b><small>${esc(RARITY[c.rarity].label)}${(s.collection.counts?.[c.id] || 1) > 1 ? ` ×${s.collection.counts[c.id]}` : ''}</small></button>`
        : `<div class="coll-card locked"><span class="cc-i">?</span><small>${esc(RARITY[c.rarity].label)}</small></div>`).join('')}</div>`;
    }).join('')}`;
}

function quizView(s, data) {
  const today = isoDay();
  const { key, qids } = weeklyQuiz(data, today);
  const w = s.collection?.weekly?.[key] || { answers: {} };
  const answered = Object.keys(w.answers).length;
  const score = Object.values(w.answers).filter(Boolean).length;
  return `
    <section class="card">
      <div class="card-head"><h3>Quiz de la semaine</h3><span class="chip">${key}</span></div>
      <p class="small muted">Les mêmes 5 questions pour tous les supporters cette semaine. 3 bonnes réponses = 1 carte, 5/5 = 2 cartes.</p>
      ${progressBar(answered, qids.length)}
      ${answered === qids.length ? `<p class="ok"><b>Terminé : ${score}/${qids.length}</b>. Nouveau quiz lundi prochain.</p>` : ''}
    </section>
    ${qids.map((qid, i) => {
      const q = data.heritage.questions[qid];
      const a = w.answers[qid];
      return `<section class="card wq">
        <p class="eyebrow">Question ${i + 1}/${qids.length}</p><p><b>${esc(q.q)}</b></p>
        ${a === undefined
          ? `<div class="choices col">${q.choices.map((c, k) => `<button class="btn" data-wq="${qid}" data-a="${k}">${esc(c)}</button>`).join('')}</div>`
          : `<p class="${a ? 'ok' : 'warn'}">${a ? '✅' : '❌'} ${esc(q.choices[q.answer])}</p>`}
      </section>`;
    }).join('')}`;
}

export function cardHtml(c) {
  return `<div class="big-card r-${c.rarity}"><span class="cc-i">${c.icon}</span><small class="eyebrow">${esc(c.type)} · ${esc(RARITY[c.rarity].label)}</small><h3>${esc(c.title)}</h3><p class="small muted">${esc(c.sub)}</p><p class="small">${esc(c.text)}</p></div>`;
}

function showCard(data, id, s) {
  const c = allCards(data).find((x) => x.id === id);
  openModal(`<div class="modal-head"><h3>Carte</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>${cardHtml(c)}`);
}

export function showReward(reward) {
  const list = reward.cards || [reward];
  openModal(`<div class="modal-head"><h3>${reward.score !== undefined ? `Quiz terminé : ${reward.score}/5` : 'Nouvelle carte !'}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    ${list.length ? list.map((r) => `${cardHtml(r.card)}${r.duplicate ? `<p class="small muted center">Doublon : +${r.xp} XP</p>` : '<p class="small ok center">Nouvelle carte !</p>'}`).join('') : '<p>Pas de carte cette fois : 3 bonnes réponses minimum.</p>'}
    <button class="btn btn-primary" data-close>Super</button>`);
}

function matchQuiz(store, data, matchId, render) {
  const m = data.museum.matches.find((x) => x.id === matchId);
  const q = data.heritage.questions[m.quiz];
  openModal(`<div class="modal-head"><h3>${m.year} · ${esc(m.title)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p><b>${esc(q.q)}</b></p><div class="choices col">${q.choices.map((c, k) => `<button class="btn" data-mqa="${k}">${esc(c)}</button>`).join('')}</div>`, {
    onBind(el) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mqa]');
        if (!b) return;
        const r = answerMatchQuiz(store.save, data, matchId, Number(b.dataset.mqa));
        store.set(r.save);
        render();
        el.innerHTML = r.correct
          ? `<div class="modal-head"><h3>✅ Exact !</h3></div>${cardHtml(r.card.card)}<button class="btn btn-primary" data-close>Ajouter à ma collection</button>`
          : `<div class="modal-head"><h3>❌ Raté</h3></div><p>Réponse : <b>${esc(q.choices[q.answer])}</b>. Retentez plus tard.</p><button class="btn" data-close>Fermer</button>`;
      });
    },
  });
}
