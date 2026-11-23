import { esc, toast } from '../ui/components.js';
import { ensureCommunity, claimChallenge } from '../engine/community.js';

const CHALLENGES = [
  { id: 'territory', title: 'Sur le terrain', description: 'Réalisez une activité dans une commune de l’Yonne.', points: 30, done: (w) => w.activities >= 1, progress: (w) => Math.min(w.activities, 1) },
  { id: 'discovery', title: 'À la découverte de l’Yonne', description: 'Découvrez une commune que vous n’aviez pas encore visitée.', points: 25, done: (w) => w.newCity, progress: (w) => w.newCity ? 1 : 0 },
  { id: 'formation', title: 'La relève ajaïste', description: 'Convainquez une famille de rejoindre le centre de formation.', points: 40, done: (w) => w.recruits >= 1, progress: (w) => Math.min(w.recruits, 1) },
  { id: 'heritage', title: 'Transmettre la mémoire', description: 'Consultez le livre d’or de votre centre de formation.', points: 20, done: (w) => w.viewedHeritage, progress: (w) => w.viewedHeritage ? 1 : 0 },
];

function levelFor(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
function nextLevelXp(level) { return level * level * 100; }

export default {
  render({ store, data }) {
    const s = store.save;
    ensureCommunity(s);
    const c = s.community;
    const level = levelFor(c.xp);
    const floor = (level - 1) ** 2 * 100;
    const ceiling = nextLevelXp(level);
    const progress = Math.max(0, Math.min(100, ((c.xp - floor) / (ceiling - floor)) * 100));
    const cities = data.cities.cities;
    const cityNames = c.visitedCities.map((id) => cities.find((x) => x.id === id)?.name).filter(Boolean);
    const claimed = (id) => c.claimedChallenges.includes(`${s.week}:${id}`);
    const badges = [
      { icon: '🧭', title: 'Explorateur', text: '3 communes découvertes', unlocked: c.visitedCities.length >= 3 },
      { icon: '🤝', title: 'Ambassadeur de l’Yonne', text: '8 communes découvertes', unlocked: c.visitedCities.length >= 8 },
      { icon: '🌱', title: 'Passeur de formation', text: 'Un jeune promu en équipe 1', unlocked: s.goldenBook.length >= 1 },
      { icon: '⭐', title: 'Supporter engagé', text: '250 points d’engagement', unlocked: c.xp >= 250 },
    ];
    const completed = CHALLENGES.filter((x) => x.done(c.weekly)).length;
    const collectiveTarget = 1000;
    const collectivePct = Math.min(100, (c.collectivePoints / collectiveTarget) * 100);

    return `
      <section class="supporter-hero">
        <p class="eyebrow">COMMUNAUTÉ AJA · SAISON ${esc(s.season)}</p>
        <h2>Votre aventure ajaïste</h2>
        <p>Chaque action dans le jeu contribue à votre parcours de supporter et à la découverte du territoire.</p>
        <form class="supporter-name-form">
          <label for="supporter-name">Votre nom de supporter</label>
          <div class="supporter-name-row">
            <input id="supporter-name" name="name" maxlength="28" value="${esc(c.displayName)}" aria-label="Nom de supporter">
            <button class="btn btn-light" type="submit">Enregistrer</button>
          </div>
        </form>
      </section>

      <section class="card supporter-level">
        <div class="supporter-level-head">
          <div><span class="small muted">NIVEAU SUPPORTER</span><div class="supporter-level-number">${level}</div></div>
          <div class="supporter-xp"><b>${c.xp.toLocaleString('fr-FR')} XP</b><span class="small muted">Encore ${Math.max(0, ceiling - c.xp)} XP avant le niveau ${level + 1}</span></div>
        </div>
        <div class="supporter-progress"><span style="width:${progress}%"></span></div>
        <div class="supporter-level-foot"><span>Niveau ${level}</span><span>Niveau ${level + 1}</span></div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Défis de la semaine</h3><span class="chip">${completed}/${CHALLENGES.length} objectifs</span></div>
        <p class="small muted">Semaine ${s.week} · Réalisez les actions dans le jeu, puis récupérez vos points.</p>
        <div class="supporter-challenges">
          ${CHALLENGES.map((challenge) => {
            const done = challenge.done(c.weekly);
            const isClaimed = claimed(challenge.id);
            return `
              <article class="supporter-challenge ${done ? 'is-done' : ''}">
                <div class="supporter-challenge-icon">${done ? '✓' : '○'}</div>
                <div class="supporter-challenge-copy">
                  <b>${esc(challenge.title)}</b>
                  <p class="small muted">${esc(challenge.description)}</p>
                  <span class="small supporter-reward">+${challenge.points} XP</span>
                </div>
                <button class="btn btn-small ${isClaimed ? 'btn-ghost' : 'btn-primary'}" data-claim="${challenge.id}" data-points="${challenge.points}" ${!done || isClaimed ? 'disabled' : ''}>${isClaimed ? 'Obtenu' : 'Récupérer'}</button>
              </article>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Défi collectif de l’Yonne</h3><span class="chip">Prototype</span></div>
        <p>Faites progresser votre compteur d’engagement en explorant les communes, en accompagnant la formation et en participant à la vie de votre partie.</p>
        <div class="collective-score"><b>${c.collectivePoints.toLocaleString('fr-FR')}</b><span> / ${collectiveTarget.toLocaleString('fr-FR')} points</span></div>
        <div class="supporter-progress"><span style="width:${collectivePct}%"></span></div>
        <p class="small muted">${Math.round(collectivePct)} % de l’objectif · Compteur local à cette sauvegarde, pas encore partagé entre plusieurs supporters.</p>
      </section>

      <section class="card">
        <div class="card-head"><h3>Votre lien avec le territoire</h3><a href="#/map" class="link">Explorer la carte ›</a></div>
        <div class="territory-stats">
          <div><b>${c.visitedCities.length}/${cities.length}</b><span class="small muted">communes découvertes</span></div>
          <div><b>${s.goldenBook.length}</b><span class="small muted">jeune(s) passé(s) en équipe 1</span></div>
          <div><b>${Object.values(s.sponsors).filter((x) => x.signed).length}</b><span class="small muted">partenaire(s) du jeu</span></div>
        </div>
        <div class="city-pills">${cityNames.length ? cityNames.map((name) => `<span>${esc(name)}</span>`).join('') : '<span class="muted">Aucune commune découverte pour le moment.</span>'}</div>
      </section>

      <section class="card">
        <div class="card-head"><h3>La mémoire de votre centre</h3><a href="#/gold" class="link">Ouvrir le livre d’or ›</a></div>
        <p class="small muted">Une histoire de club se construit aussi avec les parcours de celles et ceux qui grandissent au centre. Retrouvez ici les joueurs que votre gestion a accompagnés jusqu’à l’équipe première.</p>
        ${s.goldenBook.length ? `
          <div class="supporter-alumni">
            ${s.goldenBook.slice().reverse().slice(0, 3).map((entry) => `
              <a class="supporter-alumni-row" href="#/player/${encodeURIComponent(entry.playerId)}">
                <span class="supporter-alumni-icon">📖</span>
                <span><b>${esc(entry.name)}</b><small>Promotion depuis les ${esc(entry.from)} · ${esc(entry.season)}</small></span>
                <strong>${entry.ovr}</strong>
              </a>`).join('')}
          </div>` : '<p class="small muted">Votre premier parcours apparaîtra ici lorsqu’un jeune du centre rejoindra l’équipe première.</p>'}
      </section>

      <section class="card">
        <div class="card-head"><h3>Vos distinctions</h3><a href="#/gold" class="link">Livre d’or ›</a></div>
        <div class="supporter-badges">
          ${badges.map((b) => `
            <div class="supporter-badge ${b.unlocked ? 'unlocked' : ''}">
              <span>${b.icon}</span><b>${esc(b.title)}</b><small>${esc(b.text)}</small>
              <em>${b.unlocked ? 'Débloqué' : 'À débloquer'}</em>
            </div>`).join('')}
        </div>
      </section>
      <p class="small muted supporter-disclaimer">Génération AJA est un prototype indépendant et non officiel. Les points, défis et compteurs collectifs sont enregistrés dans votre sauvegarde locale ou votre sauvegarde cloud personnelle ; ils ne représentent pas une communauté connectée.</p>
    `;
  },
  bind(root, { store, render, go }) {
    root.addEventListener('submit', (event) => {
      if (!event.target.matches('.supporter-name-form')) return;
      event.preventDefault();
      const value = String(new FormData(event.target).get('name') || '').trim().slice(0, 28);
      if (!value) return toast('Choisissez un nom de supporter.');
      store.update((save) => { ensureCommunity(save); save.community.displayName = value; });
      toast('Profil supporter enregistré.');
      render();
    });
    root.addEventListener('click', (event) => {
      const claim = event.target.closest('[data-claim]');
      if (claim) {
        const id = claim.dataset.claim;
        const points = Number(claim.dataset.points);
        let success = false;
        store.update((save) => { success = claimChallenge(save, id, points); });
        if (success) toast(`+${points} XP : défi accompli !`);
        render();
        return;
      }
      if (event.target.closest('a[href="#/gold"]')) {
        store.update((save) => { ensureCommunity(save); save.community.weekly.viewedHeritage = true; });
      }
    });
  },
};
