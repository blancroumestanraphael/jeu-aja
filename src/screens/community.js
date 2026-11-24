// Communauté connectée : classements, défis collectifs et événements, groupes de supporters, profil public.
import { esc, toast, progressBar } from '../ui/components.js';
import * as backend from '../state/backend.js';
import { levelFor } from '../engine/community.js';

let tab = 'classements';
let board = 'general';
const AVATARS = ['⚽', '🦁', '🔵', '⭐', '🏟️', '🧢', '🌱', '🧣', '🏆', '💙'];
const BOARDS = { general: 'Général', commune: 'Communes', departement: 'Départements', anciennete: 'Ancienneté', accomplissements: 'Accomplissements', groupes: 'Groupes', generations: 'Générations' };
const METRIC = { actions: 'actions', wins: 'victoires', goals: 'buts', quiz: 'bonnes réponses', missions: 'missions', recruits: 'recrutements' };
const STATUS = { 'en-cours': 'En cours', 'a-venir': 'À venir', termine: 'Terminé' };
const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export const supporterNav = (active) => `
  <nav class="subnav" aria-label="Supporter">
    <a href="#/supporter" class="${active === 'supporter' ? 'on' : ''}">Mon espace</a>
    <a href="#/community" class="${active === 'community' ? 'on' : ''}">Communauté</a>
  </nav>`;

export default {
  keepScroll: true,
  render({ store }) {
    return `
      ${supporterNav('community')}
      <div id="cm">${skeleton()}</div>
      <p class="small muted sync-line">${syncLine(store.save)}</p>`;
  },
  bind(root, ctx) {
    load(root, ctx);
    root.addEventListener('click', (e) => onClick(e, root, ctx));
    root.addEventListener('submit', (e) => onSubmit(e, root, ctx));
  },
};

const skeleton = () => '<div class="card"><p class="muted">Connexion à la communauté…</p></div>';

async function load(root, ctx) {
  const box = root.querySelector('#cm');
  const online = await backend.checkServer(true);
  if (!root.isConnected) return;
  if (!online) {
    box.innerHTML = `
      <section class="card offline">
        <h3>📡 Communauté hors ligne</h3>
        <p>Le serveur communautaire n’est pas joignable. Le jeu reste jouable : vos actions sont gardées et seront envoyées au retour de la connexion.</p>
        <p class="small muted">En local, lancez <code>npm start</code> ; en ligne, la fonction Netlify <code>/api</code> doit être déployée.</p>
        <button class="btn" data-retry>Réessayer</button>
      </section>`;
    return;
  }
  if (!backend.account()) { box.innerHTML = registerForm(ctx); return; }
  await backend.flush(ctx.store);
  root.querySelector('.sync-line').innerHTML = syncLine(ctx.store.save);
  box.innerHTML = `
    <div class="tabs-inline" role="tablist">
      ${[['classements', 'Classements'], ['defis', 'Défis'], ['groupes', 'Groupes'], ['profil', 'Profil']].map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="cm-body">${skeleton()}</div>`;
  loadTab(root, ctx);
}

async function loadTab(root, ctx) {
  const body = root.querySelector('#cm-body');
  try {
    if (tab === 'classements') body.innerHTML = await boardView();
    else if (tab === 'defis') body.innerHTML = await eventsView();
    else if (tab === 'groupes') body.innerHTML = await groupsView();
    else body.innerHTML = await profileEditView(ctx);
  } catch (e) {
    body.innerHTML = `<p class="card warn">${esc(e.message)}</p>`;
  }
}

function registerForm({ store, data }) {
  const c = store.save.community;
  return `
    <section class="card">
      <h3>Rejoindre la communauté</h3>
      <p class="small">Créez votre profil de supporter pour apparaître dans les classements, représenter votre commune et participer aux défis collectifs.</p>
      <form class="form" data-form="register">
        <label>Nom de supporter (public)<input name="displayName" required minlength="3" maxlength="24" value="${esc(c.displayName !== 'Supporter AJA' ? c.displayName : '')}"></label>
        <label>Commune de cœur<select name="commune"><option value="">— Hors des 8 communes —</option><option value="auxerre">Auxerre</option>
          ${data.cities.cities.map((x) => `<option value="${x.id}" ${x.id === c.homeCity ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Département<input name="departement" value="89" maxlength="3" inputmode="numeric"></label>
        <label>Supporter de l’AJA depuis<input name="supporterSince" type="number" min="1905" max="2026" value="${c.supporterSince || ''}"></label>
        <button class="btn btn-primary btn-big" type="submit">Créer mon profil</button>
      </form>
      <p class="small muted">Aucun e-mail demandé : votre compte est lié à cet appareil. Seuls votre pseudo, votre commune et vos statistiques de jeu sont publics.</p>
    </section>`;
}

async function boardView() {
  const r = await backend.leaderboard(board);
  const me = backend.account()?.userId;
  const isUsers = !['commune', 'departement', 'groupes', 'generations'].includes(board);
  const val = (x) => (board === 'anciennete' ? `${Math.floor(x.value)} j` : board === 'accomplissements' ? Math.round(x.value) : `${Math.round(x.value).toLocaleString('fr-FR')} pts`);
  return `
    <div class="chips">${Object.entries(BOARDS).map(([k, l]) => `<button class="${board === k ? 'on' : ''}" data-board="${k}">${l}</button>`).join('')}</div>
    <section class="card">
      ${board === 'generations' ? '<p class="small">Défi entre générations : moyenne des points des supporters de chaque génération (selon l’année « supporter depuis »).</p>' : ''}
      <p class="small muted">${r.total} ${isUsers ? 'supporter(s)' : 'entrée(s)'} classé(s)${r.me ? ` · vous êtes <b>${r.me.rank}<sup>e</sup></b>` : ''}</p>
      <ol class="board">${r.rows.map((x) => `
        <li class="${x.id === me ? 'me' : ''}">
          <span class="b-rank">${x.rank}</span>
          ${isUsers ? `<a href="#/profile/${encodeURIComponent(x.id)}" class="b-name"><span>${esc(x.avatar || '⚽')}</span> ${esc(x.name)}${x.commune ? ` <small>${esc(x.commune)}</small>` : ''}</a>`
            : board === 'groupes' ? `<button class="linkish b-name" data-group="${x.id}">${esc(x.name)} <small>${x.members} membres</small></button>`
            : `<span class="b-name">${esc(x.name)} <small>${x.members} supporter(s)</small></span>`}
          <b>${val(x)}</b>
        </li>`).join('') || '<li class="muted">Personne pour l’instant : soyez le premier !</li>'}</ol>
    </section>`;
}

async function eventsView() {
  const { events } = await backend.events();
  const order = { 'en-cours': 0, 'a-venir': 1, termine: 2 };
  events.sort((a, b) => order[a.status] - order[b.status] || a.start.localeCompare(b.start));
  return events.map((ev) => `
    <section class="card event ${ev.status} ${ev.completed ? 'done' : ''}">
      <div class="card-head"><h3>${esc(ev.reward?.icon || '🎯')} ${esc(ev.title)}</h3><span class="chip">${STATUS[ev.status]}</span></div>
      <p class="small">${esc(ev.text)}</p>
      <p class="small muted">${fmtDay(ev.start)} → ${fmtDay(ev.end)} · ${ev.scope === 'yonne' ? 'supporters de l’Yonne (89)' : ev.scope === 'commune' ? 'compétition entre communes' : 'tous les supporters'}</p>
      <div class="ev-progress"><b>${ev.progress.toLocaleString('fr-FR')}</b> / ${ev.target.toLocaleString('fr-FR')} ${METRIC[ev.metric]}</div>
      ${progressBar(ev.progress, ev.target)}
      <p class="small">${ev.completed ? '✅ Objectif atteint ! ' : ''}${ev.contributors} contributeur(s)${ev.reward ? ` · 🎁 ${esc(ev.reward.badge)}${ev.reward.unlock ? ` + ${esc(ev.reward.unlock)}` : ''}` : ''}</p>
      ${ev.communes.length ? `<ol class="board mini">${ev.communes.slice(0, 5).map((x, i) => `<li><span class="b-rank">${i + 1}</span><span class="b-name">${esc(x.name)}</span><b>${x.value}</b></li>`).join('')}</ol>` : ''}
    </section>`).join('');
}

async function groupsView() {
  const me = (await backend.me()).profile;
  let mine = '';
  if (me.group) {
    const { group } = await backend.group(me.group.id);
    mine = `
      <section class="card">
        <div class="card-head"><h3>👥 ${esc(group.name)}</h3><span class="chip">${group.total.toLocaleString('fr-FR')} pts</span></div>
        ${group.description ? `<p class="small">${esc(group.description)}</p>` : ''}
        ${group.code ? `<p class="small">Code d’invitation : <b class="code">${esc(group.code)}</b> — partagez-le avec vos amis de tribune.</p>` : ''}
        <ol class="board">${group.members.map((m, i) => `<li class="${m.id === me.id ? 'me' : ''}"><span class="b-rank">${i + 1}</span><a class="b-name" href="#/profile/${m.id}">${esc(m.avatar)} ${esc(m.name)} <small>niv. ${m.level}</small></a><b>${m.points} pts</b></li>`).join('')}</ol>
        <button class="btn btn-danger btn-small" data-leave>Quitter le groupe</button>
      </section>`;
  }
  return `${mine}
    <section class="card">
      <h3>${me.group ? 'Changer de groupe' : 'Rejoindre un groupe'}</h3>
      <form class="form row" data-form="join"><input name="code" placeholder="Code (ex. 3F9A1C)" maxlength="6" required><button class="btn" type="submit">Rejoindre</button></form>
      <h3>Créer un groupe</h3>
      <form class="form" data-form="create">
        <input name="name" placeholder="Nom (ex. Les Ultras de Joigny)" minlength="3" maxlength="32" required>
        <input name="description" placeholder="Description (facultatif)" maxlength="140">
        <button class="btn btn-primary" type="submit">Créer</button>
      </form>
      <p class="small muted">Jusqu’à 50 membres par groupe. Le classement des groupes additionne les points de leurs membres.</p>
    </section>`;
}

async function profileEditView({ data }) {
  const p = (await backend.me()).profile;
  return `
    ${profileCard(p)}
    <section class="card">
      <h3>Personnaliser mon profil</h3>
      <form class="form" data-form="profile">
        <label>Avatar</label>
        <div class="avatars">${AVATARS.map((a) => `<label class="av"><input type="radio" name="avatar" value="${a}" ${a === p.avatar ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
        <label>Nom de supporter<input name="displayName" minlength="3" maxlength="24" value="${esc(p.displayName)}"></label>
        <label>Présentation<input name="bio" maxlength="140" value="${esc(p.bio || '')}" placeholder="Abonné tribune Vaux depuis 1998…"></label>
        <label>Joueur préféré<input name="favoritePlayer" maxlength="40" value="${esc(p.favoritePlayer || '')}" placeholder="Guy Roux, Djibril Cissé, Kévin Danois…"></label>
        <label>Commune de cœur<select name="commune"><option value="">— Hors des 8 communes —</option><option value="auxerre" ${p.commune === 'auxerre' ? 'selected' : ''}>Auxerre</option>
          ${data.cities.cities.map((x) => `<option value="${x.id}" ${x.id === p.commune ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Département<input name="departement" value="${esc(p.departement)}" maxlength="3"></label>
        <label>Supporter depuis<input name="supporterSince" type="number" min="1905" max="2026" value="${p.supporterSince || ''}"></label>
        <button class="btn btn-primary" type="submit">Enregistrer</button>
      </form>
    </section>
    <p class="small muted">Votre compte est lié à cet appareil. <button class="linkish small" data-forget>Se déconnecter de cet appareil</button></p>`;
}

export function profileCard(p) {
  return `
    <section class="card public-profile">
      <div class="pp-head">
        <span class="pp-avatar">${esc(p.avatar)}</span>
        <div><h2>${esc(p.displayName)}</h2>
          <p class="small muted">${p.communeName ? `♥ ${esc(p.communeName)} · ` : ''}Dép. ${esc(p.departement)}${p.generation ? ` · ${esc(p.generation)}` : ''}</p></div>
        <div class="pp-level"><span>Niv.</span><b>${levelFor(p.points)}</b></div>
      </div>
      ${p.bio ? `<p>« ${esc(p.bio)} »</p>` : ''}
      ${p.favoritePlayer ? `<p class="small">Joueur préféré : <b>${esc(p.favoritePlayer)}</b></p>` : ''}
      <div class="stat-grid">
        <div><span>⭐</span><b>${p.points.toLocaleString('fr-FR')}</b><small>points</small></div>
        <div><span>📅</span><b>${p.seniorityDays}</b><small>jours d’ancienneté</small></div>
        <div><span>🔥</span><b>${p.activeDays}</b><small>jours actifs</small></div>
        <div><span>📍</span><b>${p.stats.missions}</b><small>missions</small></div>
        <div><span>⚽</span><b>${p.stats.wins}/${p.stats.matches}</b><small>victoires</small></div>
        <div><span>📜</span><b>${p.stats.quizCorrect}</b><small>bonnes réponses</small></div>
      </div>
      ${p.group ? `<p class="small">👥 Groupe : <b>${esc(p.group.name || '')}</b></p>` : ''}
      <h4>Trophées (${p.trophies.length})</h4>
      <div class="trophies">${p.trophies.map((t) => `<span title="${esc(t.title)}">${esc(t.icon)} ${esc(t.title)}</span>`).join('') || '<span class="muted">Aucun trophée pour l’instant.</span>'}</div>
    </section>`;
}

async function onClick(e, root, ctx) {
  const t = e.target.closest('[data-tab],[data-board],[data-retry],[data-leave],[data-forget],[data-group]');
  if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab)); return loadTab(root, ctx); }
  if (t.dataset.board) { board = t.dataset.board; return loadTab(root, ctx); }
  if (t.dataset.group) { tab = 'groupes'; return showGroup(root, t.dataset.group); }
  if (t.hasAttribute('data-retry')) return load(root, ctx);
  if (t.hasAttribute('data-leave')) { await backend.leaveGroup(); toast('Groupe quitté'); return loadTab(root, ctx); }
  if (t.hasAttribute('data-forget') && confirm('Se déconnecter ? Sans sauvegarde de votre jeton, le compte ne pourra pas être récupéré.')) { backend.forgetAccount(); load(root, ctx); }
}

async function showGroup(root, id) {
  const { group } = await backend.group(id);
  root.querySelector('#cm-body').innerHTML = `
    <section class="card"><div class="card-head"><h3>👥 ${esc(group.name)}</h3><span class="chip">${group.total} pts</span></div>
    ${group.description ? `<p class="small">${esc(group.description)}</p>` : ''}
    <ol class="board">${group.members.map((m, i) => `<li><span class="b-rank">${i + 1}</span><a class="b-name" href="#/profile/${m.id}">${esc(m.avatar)} ${esc(m.name)}</a><b>${m.points} pts</b></li>`).join('')}</ol>
    <p class="small muted">Pour rejoindre ce groupe, demandez son code à un membre.</p></section>`;
}

async function onSubmit(e, root, ctx) {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.form === 'register') {
      await backend.register(f);
      ctx.store.update((s) => { s.community.displayName = f.displayName; if (f.commune && f.commune !== 'auxerre') s.community.homeCity = f.commune; if (f.supporterSince) s.community.supporterSince = Number(f.supporterSince); });
      toast('Bienvenue dans la communauté !');
      await backend.flush(ctx.store);
      return load(root, ctx);
    }
    if (form.dataset.form === 'profile') { await backend.updateProfile(f); toast('Profil enregistré'); }
    if (form.dataset.form === 'create') { await backend.createGroup(f.name, f.description); toast('Groupe créé'); }
    if (form.dataset.form === 'join') { await backend.joinGroup(f.code); toast('Groupe rejoint'); }
    loadTab(root, ctx);
  } catch (err) {
    toast(err.message);
  }
}

function syncLine(save) {
  const n = save.sync?.pending?.length || 0;
  return `${n ? `${n} action(s) en attente d’envoi au serveur.` : 'Toutes vos actions sont synchronisées.'}${save.sync?.lastSync ? ` Dernière synchro : ${new Date(save.sync.lastSync).toLocaleString('fr-FR')}.` : ''}`;
}
