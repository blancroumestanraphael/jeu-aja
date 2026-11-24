import { esc, euro, openModal, closeModal, toast, progressBar } from '../ui/components.js';
import {
  ensureCommunity, levelFor, xpForLevel, currentStreak, isoDay, dailyQuestionId, answerDaily, WEEKLY_CHALLENGES,
  challengeKey, mobilisationActive, MOBILISATION_XP,
} from '../engine/community.js';
import { missionDone } from '../engine/activities.js';
import { STAFF, staffCost } from '../engine/squad.js';
import { openDailyPack } from '../engine/collection.js';
import { showReward } from './heritage.js';
import { dailyObjectives, reminders } from '../engine/guide.js';
import { maybeOnboarding } from '../ui/onboarding.js';
import { enableNotifications, notificationsSupported } from '../state/notify.js';
import { advanceWeek, startNewSeason, fixtureOfWeek, clubById, u19OpponentOfWeek, SEASON_WEEKS } from '../engine/week.js';
import { canPlayKeyMatch } from '../engine/keymatch.js';
import { sortedTable } from '../engine/league.js';
import { signInWithGoogle } from '../state/store.js';
import { readErrors, clearErrors } from '../state/telemetry.js';

const FAC = {
  terrains: { label: 'Terrains d’entraînement', effect: '+10 % de progression des jeunes par niveau' },
  internat: { label: 'Internat du centre', effect: 'Les familles font davantage confiance (+8 %)' },
  staff: { label: 'Réseau de recruteurs dans l’Yonne', effect: 'Jeunes repérés de meilleur potentiel' },
};

const daysUntil = (iso, today) => Math.round((new Date(iso + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
const whenLabel = (n) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);
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
    ensureCommunity(s);
    const c = s.community;
    const today = isoDay();

    // Rendez-vous réel : prochain match de l'AJA d'après le calendrier officiel
    const realNext = data.fixtures.fixtures.find((x) => x.realDate >= today);
    const realClub = realNext && clubById(data, realNext.opponent);
    const dIn = realNext ? daysUntil(realNext.realDate, today) : null;
    const rendezVous = realNext ? `
      <section class="card rdv">
        <p class="eyebrow">📅 Rendez-vous · vraie Ligue 1</p>
        <h3>${realNext.home ? `AJA – ${esc(realClub.name)}` : `${esc(realClub.name)} – AJA`}</h3>
        <p class="small">${fmtDate(realNext.realDate)} · ${realNext.home ? 'à l’Abbé-Deschamps' : esc(realClub.stadium)} · <b>${whenLabel(dIn)}</b>${realNext.uncertain ? ' (date à confirmer)' : ''}</p>
        ${realNext.isKeyMatch ? `<p class="small key-note">⭐ Grand match : le Match de la veille s’ouvrira le ${fmtDate(new Date(new Date(realNext.realDate + 'T12:00:00').getTime() - 86400000).toISOString().slice(0, 10))} de 18 h à minuit.</p>` : ''}
      </section>` : '';

    // Espace supporter en bref
    const level = levelFor(c.xp);
    const floor = xpForLevel(level);
    const done = WEEKLY_CHALLENGES.filter((ch) => { const [v, t] = ch.progress(c.weekly); return v >= t; }).length;
    const claimable = WEEKLY_CHALLENGES.filter((ch) => { const [v, t] = ch.progress(c.weekly); return v >= t && !c.claimedChallenges.includes(challengeKey(s, ch.id)); }).length;
    const streak = currentStreak(c.activeDays, today);
    const supporterStrip = `
      <a class="card supporter-strip" href="#/supporter">
        <div class="ss-level"><span>Niv.</span><b>${level}</b></div>
        <div class="ss-main">
          <b>${esc(c.displayName)}</b>
          ${progressBar(c.xp - floor, xpForLevel(level + 1) - floor)}
          <span class="small muted">Objectifs de la semaine ${done}/${WEEKLY_CHALLENGES.length}${claimable ? ` · <b class="up">${claimable} à récupérer</b>` : ''}${streak > 1 ? ` · 🔥 ${streak} jours de suite` : ''}</span>
        </div>
        <span class="chev">›</span>
      </a>`;

    // Question du jour (patrimoine)
    const qid = dailyQuestionId(data.heritage, today);
    const q = data.heritage.questions[qid];
    const answeredToday = c.daily.date === today && c.daily.answered;
    const daily = `
      <section class="card daily">
        <div class="card-head"><h3>📜 La question du jour</h3><a class="link" href="#/heritage">Musée ›</a></div>
        ${answeredToday
          ? `<p>${esc(q.q)}</p><p class="${c.daily.correct ? 'ok' : 'warn'}"><b>${c.daily.correct ? 'Bravo !' : 'Raté…'}</b> Réponse : ${esc(q.choices[q.answer])}. Revenez demain pour une nouvelle question.</p>`
          : `<p>${esc(q.q)}</p><div class="choices col">${q.choices.map((ch, i) => `<button class="btn" data-daily="${i}">${esc(ch)}</button>`).join('')}</div>`}
      </section>`;

    // Mission territoriale suggérée
    const nextMission = data.cities.cities.find((x) => !missionDone(s, x.id));
    const mission = nextMission ? `
      <a class="card mission-cta" href="#/map/${nextMission.id}">
        <span class="mc-i">📍</span>
        <span><span class="eyebrow">Mission dans l’Yonne</span><br><b>${esc(nextMission.name)} — ${esc(data.territory.communes[nextMission.id].mission.title)}</b><br>
        <span class="small muted">${esc(data.territory.communes[nextMission.id].tagline)}</span></span>
        <span class="chev">›</span>
      </a>` : '';
    const mobil = f.isKeyMatch && !s.seasonOver ? `
      <div class="mobil">📣 <b>Mobilisation :</b> ${mobilisationActive(s, data) ? 'objectif atteint, l’équipe jouera avec +5 de moral !' : `gagnez ${MOBILISATION_XP} XP cette semaine pour pousser l’équipe (${c.weekly.xp}/${MOBILISATION_XP}).`}</div>` : '';

    const nextMatch = s.seasonOver
      ? `<section class="card hero">
          <p class="eyebrow">Saison ${esc(s.season)} terminée</p>
          <h2>L’AJA termine ${pos}<sup>e</sup> de Ligue 1</h2>
          <p class="muted">Les U19 de 19 ans vont quitter le centre, les U17 et U15 montent d’une catégorie.</p>
          <button class="btn btn-primary btn-big" data-action="new-season">Commencer la saison suivante</button>
        </section>`
      : `<section class="card hero">
          <p class="eyebrow">Votre saison · semaine ${s.week} / ${SEASON_WEEKS} · J${s.week}</p>
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
            </div>${mobil}` : ''}
          <p class="small muted center">U19 : AJA ${u19o.home ? 'reçoit' : 'se déplace chez'} ${esc(u19o.name)}</p>
          <button class="btn btn-primary btn-big" data-action="next">Passer à la semaine suivante ▶</button>
        </section>`;

    return `
      ${todayCard(s, data, today)}
      ${rendezVous}
      ${supporterStrip}
      ${daily}
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
        <h3>Développer le club et son territoire</h3>
        ${Object.entries(FAC).map(([k, v]) => `
          <div class="fac">
            <div><b>${v.label}</b> <span class="lvl">niv. ${s.facilities[k]}</span><br><span class="small muted">${v.effect}</span></div>
            <button class="btn btn-small" data-action="upgrade" data-k="${k}" ${s.budget < facilityCost(s.facilities[k]) || s.facilities[k] >= 5 ? 'disabled' : ''}>
              ${s.facilities[k] >= 5 ? 'Max' : euro(facilityCost(s.facilities[k]))}</button>
          </div>`).join('')}
        <h4>Staff technique</h4>
        ${Object.entries(STAFF).map(([k, v]) => `
          <div class="fac">
            <div><b>${v.label}</b> <span class="lvl">niv. ${s.staff[k]}</span><br><span class="small muted">${v.effect}</span></div>
            <button class="btn btn-small" data-action="staff" data-k="${k}" ${s.budget < staffCost(s.staff[k]) || s.staff[k] >= 5 ? 'disabled' : ''}>
              ${s.staff[k] >= 5 ? 'Max' : euro(staffCost(s.staff[k]))}</button>
          </div>`).join('')}
      </section>

      <section class="card">
        <div class="card-head"><h3>Derniers événements</h3><a class="link" href="#/gold">Livre d’or (${s.goldenBook.length})</a></div>
        <ul class="log">${s.log.slice(-6).reverse().map((l) => `<li><span class="muted">S${l.week}</span> ${esc(l.text)}</li>`).join('')}</ul>
      </section>

      <section class="links">
        <a class="btn btn-ghost" href="#/table">Classement</a>
        <a class="btn btn-ghost" href="#/agenda">Agenda</a>
        <button class="btn btn-ghost" data-action="settings">Réglages</button>
      </section>`;
  },

  bind(root, { store, data, go, render }) {
    maybeOnboarding(store, render);
    root.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-daily]');
      if (d) {
        const { save, correct } = answerDaily(store.save, data.heritage, isoDay(), Number(d.dataset.daily));
        if (correct !== null) {
          store.set(save);
          toast(correct ? 'Bonne réponse ! +15 XP' : 'Raté… +5 XP pour la participation');
          render();
        }
        return;
      }
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
      } else if (a === 'pack') {
        const { save, result } = openDailyPack(store.save, data, isoDay());
        if (!result) return;
        store.set(save);
        render();
        showReward(result);
      } else if (a === 'staff') {
        const k = el.dataset.k;
        const cost = staffCost(store.save.staff[k]);
        if (store.save.budget < cost) return;
        store.update((s) => { s.budget -= cost; s.staff[k] += 1; s.log.push({ week: s.week, text: `${STAFF[k].label} : niveau ${s.staff[k]}.` }); });
        toast(`${STAFF[k].label} : niveau ${store.save.staff[k]}`);
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
    ${notificationsSupported() ? `<button class="btn btn-small" data-k="notif">${Notification.permission === 'granted' ? '🔔 Rappels activés' : '🔔 Activer les rappels sur cet appareil'}</button>
    <p class="small muted">Un rappel utile par jour au plus : Match de la veille, quiz, match de l’AJA.</p>` : ''}
    <p class="small"><button class="linkish small" data-k="tuto">Revoir le tutoriel</button></p>
    <label class="toggle"><input type="checkbox" data-k="demo" ${s.settings.demoKeyMatch ? 'checked' : ''}>
      <span>Match de la veille jouable à tout moment (mode démo)</span></label>
    <p class="small muted">Désactivé : le Match de la veille ne s’ouvre que la veille du vrai match, de 18 h à minuit.</p>
    <hr>
    <p class="small">Sauvegarde : ${cloud.enabled ? (cloud.user ? `cloud (${esc(cloud.user.email || 'compte')})` : 'locale — connectez-vous pour la synchroniser') : 'locale (cet appareil)'}</p>
    ${cloud.enabled && !cloud.user ? '<button class="btn" data-k="login">Se connecter avec Google</button>' : ''}
    <p class="small muted">Graine de la partie : ${s.seed}</p>
    <hr>
    <p class="small"><b>Sauvegarde</b> (version ${s.version}) : exportez votre partie pour la garder ou la transférer.</p>
    <div class="choices"><button class="btn" data-k="save-export">Exporter la partie</button>
    <label class="btn">Importer une partie<input type="file" accept="application/json" data-k="save-import" hidden></label></div>
    ${readErrors().length ? `<p class="small warn">${readErrors().length} erreur(s) enregistrée(s) sur cet appareil. <button class="linkish small" data-k="errors">Voir / effacer</button></p>` : ''}
    <hr>
    <p class="small"><b>Mesure de l’engagement</b> (panel de test) : exportez vos statistiques de jeu, sans donnée personnelle.</p>
    <button class="btn" data-k="export">Exporter mes statistiques (JSON)</button>
    <hr>
    <button class="btn btn-danger" data-k="reset">Recommencer une nouvelle partie</button>`, {
    onBind(m) {
      m.querySelector('[data-k="notif"]')?.addEventListener('click', async () => {
        toast((await enableNotifications()) ? 'Rappels activés' : 'Rappels refusés par le navigateur');
        closeModal();
      });
      m.querySelector('[data-k="tuto"]').addEventListener('click', () => {
        store.update((x) => { x.onboarding = { done: false, step: 0 }; });
        closeModal();
        render();
      });
      m.querySelector('[data-k="demo"]').addEventListener('change', (e) => {
        store.update((x) => { x.settings.demoKeyMatch = e.target.checked; });
        render();
      });
      m.querySelector('[data-k="login"]')?.addEventListener('click', async () => {
        try { await signInWithGoogle(); store.persist(); closeModal(); toast('Connecté'); } catch { toast('Connexion impossible'); }
      });
      m.querySelector('[data-k="export"]').addEventListener('click', () => {
        download(`generation-aja-engagement-${isoDay()}.json`, JSON.stringify(engagementExport(store.save), null, 2));
      });
      m.querySelector('[data-k="save-export"]').addEventListener('click', () => {
        download(`generation-aja-${s.season}-S${s.week}.json`, store.exportSave());
      });
      m.querySelector('[data-k="save-import"]').addEventListener('change', async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          if (!confirm('Remplacer la partie en cours par celle du fichier ?')) return;
          store.importSave(await f.text());
          closeModal();
          toast('Partie importée');
          render();
        } catch (err) { toast(`Import impossible : ${err.message}`); }
      });
      m.querySelector('[data-k="errors"]')?.addEventListener('click', () => {
        alert(readErrors().map((x) => `${x.at} ${x.route || ''}\n${x.msg}`).join('\n\n'));
        if (confirm('Effacer le journal d’erreurs ?')) { clearErrors(); closeModal(); }
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

/** Données d'engagement anonymes pour un test auprès d'un panel de supporters. */
export function engagementExport(s) {
  const c = s.community;
  return {
    exportedAt: new Date().toISOString(),
    season: s.season, week: s.week,
    supporter: { level: levelFor(c.xp), xp: c.xp, homeCity: c.homeCity, supporterSince: c.supporterSince },
    seniority: { firstSeen: c.firstSeen, activeDays: c.activeDays.length, days: c.activeDays },
    stats: c.stats,
    territory: { missionsDone: Object.keys(c.missionsDone), visitedCities: c.visitedCities, reputation: Object.fromEntries(Object.entries(s.cities).map(([k, v]) => [k, v.reputation])) },
    heritage: { erasCompleted: c.heritage.items, answered: Object.keys(c.heritage.answered).length },
    challengesClaimed: c.claimedChallenges.length,
    goldenBook: s.goldenBook.length,
  };
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function todayCard(s, data, today) {
  const objs = dailyObjectives(s, data, today);
  const next = objs.find((o) => !o.done);
  const done = objs.filter((o) => o.done).length;
  const rem = reminders(s, data, today);
  const link = (o, cls = '') => (o.action ? `<button class="${cls}" data-action="${o.action}">` : `<a class="${cls}" href="${o.href}">`);
  const end = (o) => (o.action ? '</button>' : '</a>');
  return `
    <section class="card today">
      <div class="card-head"><h3>Aujourd’hui</h3><span class="chip">${done}/${objs.length}</span></div>
      ${next ? `${link(next, 'next-step')}<span class="ns-i">${next.icon}</span><span><span class="eyebrow">Prochaine étape</span><br><b>${esc(next.title)}</b></span><span class="chev">›</span>${end(next)}` : ''}
      <ul class="objectives">${objs.filter((o) => o !== next).slice(0, 5).map((o) => `<li class="${o.done ? 'done' : ''}">${link(o)}<span>${o.done ? '✓' : o.icon}</span>${esc(o.title)}${end(o)}</li>`).join('')}</ul>
      ${rem.length ? `<div class="reminders">${rem.map((r) => `<p class="small">${r.icon} ${r.href ? `<a href="${r.href}">${esc(r.text)}</a>` : esc(r.text)}</p>`).join('')}</div>` : ''}
    </section>`;
}
