// Espace supporter : profil, ancienneté, progression (avec effets en jeu), statistiques, défis, succès.
import { esc, toast, progressBar } from '../ui/components.js';
import { supporterNav } from './community.js';
import {
  ensureCommunity, levelFor, xpForLevel, PERKS, GENERATIONS, generationOf, WEEKLY_CHALLENGES, challengeKey, claimChallenge,
  collectiveChallenges, achievements, currentStreak, seniorityDays, isoDay,
} from '../engine/community.js';

const YEARS = Array.from({ length: 2026 - 1960 + 1 }, (_, i) => 2026 - i);

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    ensureCommunity(s);
    const c = s.community;
    const today = isoDay();
    const level = levelFor(c.xp);
    const floor = xpForLevel(level);
    const ceiling = xpForLevel(level + 1);
    const gen = generationOf(c.supporterSince);
    const cities = data.cities.cities;
    const home = cities.find((x) => x.id === c.homeCity);
    const ach = achievements(s, data, today);
    const unlocked = ach.filter((a) => a.ok).length;
    const stats = [
      ['📍', Object.keys(c.missionsDone).length, 'missions dans l’Yonne'],
      ['🌱', c.stats.recruits, 'jeunes recrutés'],
      ['⭐', c.stats.alumniEstablished, 'formés installés en équipe 1'],
      ['📜', `${c.stats.quizCorrect}/${c.stats.quizAnswered}`, 'bonnes réponses patrimoine'],
      ['🌙', c.stats.keyMatches, 'Matchs de la veille'],
      ['📅', c.stats.weeksPlayed, 'semaines de jeu'],
    ];

    return `
      ${supporterNav('supporter')}
      <section class="supporter-hero">
        <p class="eyebrow">Espace supporter · saison ${esc(s.season)}</p>
        <h2>${esc(c.displayName)}</h2>
        <p>${gen ? `${esc(gen.label)} · supporter depuis ${c.supporterSince}` : 'Dites-nous depuis quand vous supportez l’AJA.'}${home ? ` · ♥ ${esc(home.name)}` : ''}</p>
        <div class="seniority">
          <div><b>${seniorityDays(c.firstSeen, today)}</b><span>jour(s) d’ancienneté</span></div>
          <div><b>${c.activeDays.length}</b><span>jour(s) de visite</span></div>
          <div><b>🔥 ${currentStreak(c.activeDays, today)}</b><span>jour(s) de suite</span></div>
        </div>
        <details class="profile-edit">
          <summary>Modifier mon profil</summary>
          <form class="supporter-name-form">
            <label for="sp-name">Nom de supporter</label>
            <input id="sp-name" name="name" maxlength="28" value="${esc(c.displayName)}">
            <label for="sp-city">Commune de cœur</label>
            <select id="sp-city" name="city"><option value="">— Aucune —</option>${cities.map((x) => `<option value="${x.id}" ${x.id === c.homeCity ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
            <label for="sp-year">Supporter de l’AJA depuis</label>
            <select id="sp-year" name="year"><option value="">—</option>${YEARS.map((y) => `<option ${y === c.supporterSince ? 'selected' : ''}>${y}</option>`).join('')}</select>
            <button class="btn btn-light" type="submit">Enregistrer</button>
          </form>
        </details>
      </section>

      <section class="card supporter-level">
        <div class="supporter-level-head">
          <div><span class="small muted">NIVEAU SUPPORTER</span><div class="supporter-level-number">${level}</div></div>
          <div class="supporter-xp"><b>${c.xp.toLocaleString('fr-FR')} XP</b><span class="small muted">Encore ${ceiling - c.xp} XP avant le niveau ${level + 1}</span></div>
        </div>
        ${progressBar(c.xp - floor, ceiling - floor)}
        <h4>Ce que votre engagement apporte au club</h4>
        <ul class="perks">${PERKS.map((p) => `
          <li class="${level >= p.level ? 'on' : ''}"><span class="perk-i">${p.icon}</span>
            <span><b>${esc(p.title)}</b> <span class="small muted">· niveau ${p.level}</span><br><span class="small">${esc(p.text)}</span></span>
            <span class="perk-s">${level >= p.level ? '✓ actif' : '🔒'}</span></li>`).join('')}</ul>
      </section>

      <section class="card">
        <h3>Mes statistiques</h3>
        <div class="stat-grid">${stats.map(([i, v, l]) => `<div><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Défis de la semaine</h3><span class="chip">Semaine ${s.week}</span></div>
        <div class="supporter-challenges">
          ${WEEKLY_CHALLENGES.map((ch) => {
            const [v, t] = ch.progress(c.weekly);
            const done = v >= t;
            const claimed = c.claimedChallenges.includes(challengeKey(s, ch.id));
            return `
              <article class="supporter-challenge ${done ? 'is-done' : ''}">
                <div class="supporter-challenge-icon">${done ? '✓' : ch.icon}</div>
                <div class="supporter-challenge-copy"><b>${esc(ch.title)}</b><p class="small muted">${esc(ch.text)}</p><span class="small supporter-reward">+${ch.xp} XP</span></div>
                <button class="btn btn-small ${claimed ? 'btn-ghost' : 'btn-primary'}" data-claim="${ch.id}" ${!done || claimed ? 'disabled' : ''}>${claimed ? 'Obtenu' : 'Récupérer'}</button>
              </article>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Défis collectifs</h3><span class="chip">Prototype</span></div>
        <div class="collective">${collectiveChallenges(s, data).map((x) => `
          <div class="coll ${x.value >= x.target ? 'done' : ''} ${x.id === 'mobilisation' && !x.active ? 'idle' : ''}">
            <div class="coll-head"><span>${x.icon}</span><b>${esc(x.title)}</b><span class="small">${Math.min(x.value, x.target)}/${x.target}</span></div>
            <p class="small muted">${esc(x.text)}</p>
            ${progressBar(x.value, x.target)}
            <p class="small">🎁 ${esc(x.reward)}</p>
          </div>`).join('')}</div>
        <p class="small muted">Défis de votre partie. Les défis partagés par tous les supporters (Yonne, communes, événements) sont dans l’onglet <a href="#/community">Communauté</a>.</p>
      </section>

      <section class="card">
        <div class="card-head"><h3>Succès</h3><span class="chip">${unlocked}/${ach.length}</span></div>
        <div class="supporter-badges">${ach.map((b) => `
          <div class="supporter-badge ${b.ok ? 'unlocked' : ''}"><span>${b.icon}</span><b>${esc(b.title)}</b><small>${esc(b.text)}</small><em>${b.ok ? 'Débloqué' : 'À débloquer'}</em></div>`).join('')}</div>
      </section>

      <section class="card">
        <h3>Les générations de supporters</h3>
        <ul class="gens">${GENERATIONS.map((g) => `<li class="${gen?.id === g.id ? 'me' : ''}"><b>${esc(g.label)}</b><span class="small muted">${g.from ? `${g.from} – ${g.to < 9999 ? g.to : 'aujourd’hui'}` : `jusqu’en ${g.to}`}</span></li>`).join('')}</ul>
        <p class="small muted">Le défi entre générations se joue dans <a href="#/community">Communauté → Classements → Générations</a>.</p>
      </section>

      <p class="small muted supporter-disclaimer">Génération AJA est un prototype indépendant et non officiel. Votre espace personnel est enregistré dans votre sauvegarde ; vos actions sont envoyées au serveur communautaire (classements, défis) quand vous avez créé votre profil.</p>`;
  },

  bind(root, { store, render }) {
    root.addEventListener('submit', (e) => {
      if (!e.target.matches('.supporter-name-form')) return;
      e.preventDefault();
      const f = new FormData(e.target);
      const name = String(f.get('name') || '').trim().slice(0, 28);
      if (!name) return toast('Choisissez un nom de supporter.');
      store.update((s) => {
        ensureCommunity(s);
        s.community.displayName = name;
        s.community.homeCity = f.get('city') || null;
        s.community.supporterSince = f.get('year') ? Number(f.get('year')) : null;
      });
      toast('Profil enregistré');
      render();
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-claim]');
      if (!b) return;
      const ch = WEEKLY_CHALLENGES.find((x) => x.id === b.dataset.claim);
      const { save, ok } = claimChallenge(store.save, ch.id);
      if (ok) { store.set(save); toast(`+${ch.xp} XP : défi accompli !`); }
      render();
    });
  },
};
