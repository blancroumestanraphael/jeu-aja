import { esc, euro, openModal, closeModal, toast } from '../ui/components.js';
import { advanceWeek, startNewSeason, fixtureOfWeek, clubById, u19OpponentOfWeek, SEASON_WEEKS } from '../engine/week.js';
import { canPlayKeyMatch } from '../engine/keymatch.js';
import { sortedTable } from '../engine/league.js';
import { signInWithGoogle } from '../state/store.js';

const FAC = {
  terrains: { label: 'Terrains d’entraînement', effect: '+10 % de progression par niveau' },
  internat: { label: 'Internat', effect: '+8 % de réussite avec les parents' },
  staff: { label: 'Staff de recrutement', effect: 'Jeunes révélés de meilleur potentiel' },
};
export const facilityCost = (lvl) => 8000 * lvl;

const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export default {
  render({ store, data }) {
    const s = store.save;
    const pos = s.table.auxerre.p ? sortedTable(s.table).findIndex((r) => r.id === 'auxerre') + 1 : 0;
    const f = fixtureOfWeek(data, s.week);
    const club = clubById(data, f.opponent);
    const key = canPlayKeyMatch(s, data);
    const u19o = u19OpponentOfWeek(data, s.week);
    const rep = s.lastReport;
    const pending = s.messages.filter((m) => m.status === 'pending');

    const nextMatch = s.seasonOver
      ? `<section class="card hero">
          <p class="eyebrow">Saison ${esc(s.season)} terminée</p>
          <h2>L’AJA termine ${pos}<sup>e</sup> de Ligue 1</h2>
          <p class="muted">Les U19 de 19 ans vont quitter le centre, les U17 et U15 montent d’une catégorie.</p>
          <button class="btn btn-primary btn-big" data-action="new-season">Commencer la saison suivante</button>
        </section>`
      : `<section class="card hero">
          <p class="eyebrow">Semaine ${s.week} / ${SEASON_WEEKS} · Ligue 1 · J${s.week}</p>
          <div class="fixture">
            <div class="fx-team"><span class="fx-dot" style="background:var(--blue)"></span>${f.home ? 'AJ Auxerre' : esc(club.name)}</div>
            <div class="fx-vs">vs</div>
            <div class="fx-team">${f.home ? esc(club.name) : 'AJ Auxerre'}<span class="fx-dot" style="background:${esc(club.color)}"></span></div>
          </div>
          <p class="muted small center">${f.home ? 'Stade de l’Abbé-Deschamps' : 'Déplacement ' + esc(club.stadium)} · vrai match le ${fmtDate(f.realDate)}${f.uncertain ? ' (date à confirmer)' : ''} · niveau adverse ${club.level}</p>
          ${f.isKeyMatch ? `
            <div class="key-banner">
              <strong>⭐ Grand match</strong>
              ${key.played ? '<span>Match de la veille joué ✔</span>' : key.ok
                ? `<button class="btn btn-gold" data-action="key">Jouer le Match de la veille</button>${key.demo ? '<span class="small">Mode démo (hors fenêtre de la veille, 18 h–minuit)</span>' : ''}`
                : `<span class="small">Ouvert la veille du vrai match, de 18 h à minuit.</span>`}
            </div>` : ''}
          <p class="small muted center">U19 : AJA ${u19o.home ? 'reçoit' : 'se déplace chez'} ${esc(u19o.name)}</p>
          <button class="btn btn-primary btn-big" data-action="next">Passer à la semaine suivante ▶</button>
        </section>`;

    return `
      ${nextMatch}

      <section class="grid-3">
        <a class="stat" href="#/table"><span class="stat-v">${pos ? `${pos}<sup>e</sup>` : '–'}</span><span class="stat-l">Ligue 1</span></a>
        <div class="stat"><span class="stat-v">${euro(s.budget)}</span><span class="stat-l">Budget</span></div>
        <a class="stat" href="#/map"><span class="stat-v">${s.travelPointsLeft}</span><span class="stat-l">Déplacements</span></a>
      </section>

      ${pending.length ? `<a class="card alert" href="#/messages">📨 <b>${pending.length}</b> message${pending.length > 1 ? 's' : ''} en attente — ${esc(pending[0].title)}</a>` : ''}

      ${rep ? `
      <section class="card">
        <div class="card-head"><h3>Bilan semaine ${rep.week}</h3><a href="#/match/replay" class="link">Revoir le match</a></div>
        <div class="result-line res-${rep.l1.outcome}"><span>${esc(rep.l1.home)}</span><b>${rep.l1.hg} - ${rep.l1.ag}</b><span>${esc(rep.l1.away)}</span></div>
        <div class="result-line small res-${rep.u19.outcome}"><span>${esc(rep.u19.home)}</span><b>${rep.u19.hg} - ${rep.u19.ag}</b><span>${esc(rep.u19.away)}</span></div>
        ${rep.progress.length ? `<p class="small"><b>Progression :</b> ${rep.progress.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 4).map((x) => `${esc(x.name)} ${x.from}→<b class="up">${x.to}</b>`).join(' · ')}</p>` : ''}
        ${rep.lines.map((l) => `<p class="small">${esc(l)}</p>`).join('')}
        <p class="small muted">Recettes de la semaine : +${euro(rep.income)}</p>
      </section>` : ''}

      <section class="card">
        <h3>Installations</h3>
        ${Object.entries(FAC).map(([k, v]) => `
          <div class="fac">
            <div><b>${v.label}</b> <span class="lvl">niv. ${s.facilities[k]}</span><br><span class="small muted">${v.effect}</span></div>
            <button class="btn btn-small" data-action="upgrade" data-k="${k}" ${s.budget < facilityCost(s.facilities[k]) || s.facilities[k] >= 5 ? 'disabled' : ''}>
              ${s.facilities[k] >= 5 ? 'Max' : euro(facilityCost(s.facilities[k]))}</button>
          </div>`).join('')}
      </section>

      <section class="card">
        <div class="card-head"><h3>Derniers événements</h3><a class="link" href="#/gold">Livre d’or (${s.goldenBook.length})</a></div>
        <ul class="log">${s.log.slice(-6).reverse().map((l) => `<li><span class="muted">S${l.week}</span> ${esc(l.text)}</li>`).join('')}</ul>
      </section>

      <section class="links">
        <a class="btn btn-ghost" href="#/table">Classement</a>
        <button class="btn btn-ghost" data-action="calendar">Calendrier</button>
        <button class="btn btn-ghost" data-action="settings">Réglages</button>
      </section>`;
  },

  bind(root, { store, data, go, render }) {
    root.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const a = el.dataset.action;
      if (a === 'next') {
        el.disabled = true;
        const { save } = advanceWeek(store.save, data);
        store.set(save);
        go('match', 'replay');
      } else if (a === 'key') {
        go('match', 'veille');
      } else if (a === 'new-season') {
        const { save } = startNewSeason(store.save, data);
        store.set(save);
        toast(`Saison ${save.season} : c’est reparti !`);
        render();
      } else if (a === 'upgrade') {
        const k = el.dataset.k;
        const cost = facilityCost(store.save.facilities[k]);
        if (store.save.budget < cost) return;
        store.update((s) => { s.budget -= cost; s.facilities[k] += 1; s.log.push({ week: s.week, text: `${FAC[k].label} : niveau ${s.facilities[k]}.` }); });
        toast(`${FAC[k].label} améliorés !`);
        render();
      } else if (a === 'calendar') {
        showCalendar(store, data);
      } else if (a === 'settings') {
        showSettings(store, render);
      }
    });
  },
};

function showCalendar(store, data) {
  const s = store.save;
  const rows = data.fixtures.fixtures.map((f) => {
    const club = clubById(data, f.opponent);
    const r = s.results.find((x) => x.week === f.week && x.comp === 'L1');
    return `<tr class="${f.week === s.week ? 'current' : ''}">
      <td>J${f.week}</td><td>${fmtDate(f.realDate)}</td>
      <td>${f.home ? 'vs' : '@'} ${esc(club.name)} ${f.isKeyMatch ? '⭐' : ''}</td>
      <td class="res-${r?.outcome || ''}">${r ? `${r.hg}-${r.ag}` : ''}</td></tr>`;
  }).join('');
  openModal(`
    <div class="modal-head"><h3>Calendrier ${esc(s.season)}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <div class="scroll"><table class="tbl"><tbody>${rows}</tbody></table></div>
    <p class="small muted">⭐ = grand match (Match de la veille). Dates : calendrier LFP ${esc(data.fixtures.season)}.</p>`);
}

function showSettings(store, render) {
  const s = store.save;
  const cloud = store.cloud;
  openModal(`
    <div class="modal-head"><h3>Réglages</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <label class="toggle"><input type="checkbox" data-k="demo" ${s.settings.demoKeyMatch ? 'checked' : ''}>
      <span>Match de la veille jouable à tout moment (mode démo)</span></label>
    <p class="small muted">Désactivé : le Match de la veille ne s’ouvre que la veille du vrai match, de 18 h à minuit.</p>
    <hr>
    <p class="small">Sauvegarde : ${cloud.enabled ? (cloud.user ? `cloud (${esc(cloud.user.email || 'compte')})` : 'locale — connectez-vous pour la synchroniser') : 'locale (cet appareil)'}</p>
    ${cloud.enabled && !cloud.user ? '<button class="btn" data-k="login">Se connecter avec Google</button>' : ''}
    <p class="small muted">Graine de la partie : ${s.seed}</p>
    <hr>
    <button class="btn btn-danger" data-k="reset">Recommencer une nouvelle partie</button>`, {
    onBind(m) {
      m.querySelector('[data-k="demo"]').addEventListener('change', (e) => {
        store.update((x) => { x.settings.demoKeyMatch = e.target.checked; });
        render();
      });
      m.querySelector('[data-k="login"]')?.addEventListener('click', async () => {
        try { await signInWithGoogle(); store.persist(); closeModal(); toast('Connecté'); } catch { toast('Connexion impossible'); }
      });
      m.querySelector('[data-k="reset"]').addEventListener('click', () => {
        if (confirm('Effacer la partie en cours et recommencer ?')) {
          store.reset();
          closeModal();
          location.hash = '#/home';
          render();
        }
      });
    },
  });
}
