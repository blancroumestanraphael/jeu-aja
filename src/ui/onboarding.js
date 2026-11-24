// Tutoriel de première partie (4 étapes) et célébration des montées de niveau.
import { openModal, closeModal, esc } from './components.js';
import { levelFor, PERKS } from '../engine/community.js';

const STEPS = [
  { icon: '⚽', title: 'Bienvenue à l’AJA', text: 'Vous dirigez l’équipe 1 (vrais joueurs, vrai calendrier de Ligue 1) et le centre de formation. Chaque « semaine suivante » joue les matchs et fait progresser vos jeunes.', cta: 'Onglet Club : composition, plan de jeu, mercato, contrats.' },
  { icon: '📍', title: 'L’Yonne, terre de l’AJA', text: 'Découvrez 8 communes : relevez leur mission pour gagner la confiance des clubs locaux, recrutez les meilleurs jeunes et faites rayonner l’AJA.', cta: 'Onglet Yonne : 2 déplacements par semaine.' },
  { icon: '🏛️', title: 'Le musée et votre collection', text: 'Traversez l’histoire du club depuis 1905, répondez à la question du jour et au quiz de la semaine, collectionnez les cartes des légendes et des grands matchs.', cta: 'Onglet Musée : une carte offerte chaque jour.' },
  { icon: '💙', title: 'Une communauté de supporters', text: 'Votre engagement vous fait monter de niveau, avec de vrais effets dans le jeu. Créez votre profil pour rejoindre les classements, votre commune et les défis collectifs.', cta: 'Onglet Supporter → Communauté.' },
];

export function maybeOnboarding(store, render) {
  const s = store.save;
  if (!s || s.onboarding?.done !== false) return;
  let i = s.onboarding.step || 0;
  const view = () => {
    const st = STEPS[i];
    return `
      <div class="onb">
        <div class="onb-dots">${STEPS.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
        <span class="onb-i">${st.icon}</span>
        <h2>${esc(st.title)}</h2>
        <p>${esc(st.text)}</p>
        <p class="small muted">${esc(st.cta)}</p>
        <div class="choices">
          <button class="btn" data-skip>Passer</button>
          <button class="btn btn-primary" data-next>${i < STEPS.length - 1 ? 'Suivant' : 'C’est parti !'}</button>
        </div>
      </div>`;
  };
  const finish = () => { store.update((x) => { x.onboarding = { done: true }; }); closeModal(); render(); };
  openModal(view(), {
    dismissable: false,
    onBind(el) {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-skip]')) return finish();
        if (e.target.closest('[data-next]')) {
          if (i >= STEPS.length - 1) return finish();
          i++;
          store.update((x) => { x.onboarding.step = i; });
          el.innerHTML = view();
        }
      });
    },
  });
}

/** Observe l'XP : affiche une célébration à chaque montée de niveau. */
export function watchLevelUps(store) {
  let last = store.save ? levelFor(store.save.community?.xp || 0) : null;
  store.subscribe((s) => {
    if (!s?.community) return;
    const lvl = levelFor(s.community.xp);
    if (last !== null && lvl > last) celebrate(lvl);
    last = lvl;
  });
}

function celebrate(level) {
  if (document.querySelector('.modal-wrap, .toast')) return setTimeout(() => celebrate(level), 900);
  const perk = PERKS.find((p) => p.level === level);
  const confetti = Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.12}s;--c:${['#0a3d91', '#e3a400', '#6f9be0', '#ffffff'][i % 4]}"></i>`).join('');
  openModal(`
    <div class="levelup">
      <div class="confetti" aria-hidden="true">${confetti}</div>
      <p class="eyebrow">Montée de niveau</p>
      <div class="lu-level">${level}</div>
      <h2>Niveau ${level} atteint !</h2>
      ${perk ? `<p>${perk.icon} <b>${esc(perk.title)}</b> débloqué : ${esc(perk.text)}</p>` : '<p>Votre engagement pour l’AJA grandit.</p>'}
      <button class="btn btn-primary" data-close>Allez l’AJA !</button>
    </div>`);
}
