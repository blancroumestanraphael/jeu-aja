import { esc, clubNav, ratingBadge, toast, moraleIcon, availabilityBadge, progressBar } from '../ui/components.js';
import { PLANS, planFactor, styleKnown, avgRating, isAvailable } from '../engine/squad.js';
import { fixtureOfWeek, clubById } from '../engine/week.js';
import { FORMATIONS, slotRating, autoLineup } from '../engine/lineup.js';
import { TACTICS } from '../engine/match.js';
import { overall, shortName, fullName, groupOf } from '../engine/players.js';
import { ensureFirstTeamLineup } from '../engine/week.js';

let selected = null; // { kind: 'starter'|'bench'|'res', idx, id }

const GROUP_ORDER = { GK: 0, DEF: 1, MIL: 2, ATT: 3 };

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    ensureFirstTeamLineup(s);
    const A = s.teams.A;
    if (selected && !A.players.includes(selected.id)) selected = null;
    const P = (id) => s.players[id];
    const slots = FORMATIONS[A.formation];
    const reserves = A.players.filter((id) => !A.starters.includes(id) && !A.bench.includes(id))
      .map(P).sort((a, b) => GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)] || overall(b) - overall(a));
    const avg = A.starters.reduce((t, id, i) => t + slotRating(P(id), slots[i].pos), 0) / 11;
    const isSel = (kind, idx) => selected && selected.kind === kind && selected.idx === idx;

    const token = (id, i) => {
      const p = P(id);
      const r = slotRating(p, slots[i].pos);
      const off = p.position !== slots[i].pos;
      return `<button class="tok ${isSel('starter', i) ? 'sel' : ''} ${!p.isReal ? 'youth' : ''}" style="left:${slots[i].x}%;top:${slots[i].y}%"
          data-kind="starter" data-idx="${i}" data-id="${p.id}" aria-label="${esc(fullName(p))}, ${slots[i].pos}, note ${r}">
          <span class="tok-r ${off ? 'off' : ''} ${isAvailable(p) ? '' : 'unav'}">${isAvailable(p) ? r : (p.injury ? '🚑' : '🟥')}</span>
          <span class="tok-n">${esc(p.lastName)}</span>
          <span class="tok-p">${slots[i].pos}</span>
        </button>`;
    };

    const row = (p, kind, idx, slotPos = null) => `
      <div class="sq-row ${isSel(kind, idx) ? 'sel' : ''}">
        <button class="sq-main" data-kind="${kind}" data-idx="${idx}" data-id="${p.id}">
          <span class="pos pos-${slotPos || p.position}">${slotPos || p.position}</span>
          <span class="pr-main"><span class="pr-name">${esc(fullName(p))}${slotPos && slotPos !== p.position ? ` <span class="small muted">(${p.position})</span>` : ''}${p.isReal || p.freeAgent ? '' : ' <span class="tag">Formé</span>'}</span>
          <span class="pr-sub">${availabilityBadge(p)} ${p.age} ans · ${moraleIcon(p.morale)}${avgRating(p) ? ` · ⌀ ${avgRating(p)}/10 (${p.matchStats.apps} m.)` : ` · ${p.ovrSource === 'ea-fc27' ? 'EA FC 27' : p.isReal ? 'note estimée' : 'centre de formation'}`}</span></span>
          ${ratingBadge(overall(p))}
        </button>
        <a class="icon-btn" href="#/player/${p.id}" aria-label="Fiche de ${esc(fullName(p))}">›</a>
      </div>`;

    return `
      ${clubNav('team')}
      <div class="card controls">
        <label>Formation
          <select data-ctl="formation">${Object.keys(FORMATIONS).map((f) => `<option ${f === A.formation ? 'selected' : ''}>${f}</option>`).join('')}</select>
        </label>
        <label>Tactique
          <select data-ctl="tactic">${Object.entries(TACTICS).map(([k, t]) => `<option value="${k}" ${k === A.tactic ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
        </label>
        <button class="btn btn-small" data-ctl="auto">Auto</button>
      </div>
      ${planCard(s, data)}
      <p class="hint">${selected ? `<b>${esc(shortName(P(selected.id)))}</b> sélectionné : touchez un autre joueur pour échanger. <a href="#/player/${selected.id}">Voir sa fiche ›</a>` : 'Touchez deux joueurs pour les échanger, ou › pour ouvrir une fiche. Note moyenne du XI : <b>' + avg.toFixed(1) + '</b>'}</p>
      <div class="pitch" role="group" aria-label="Composition sur le terrain">
        <div class="pitch-lines"></div>
        ${A.starters.map(token).join('')}
      </div>

      <h3 class="section-title">Titulaires (11)</h3>
      <div class="list">${A.starters.map((id, i) => row(P(id), 'starter', i, slots[i].pos)).join('')}</div>

      <h3 class="section-title">Remplaçants (${A.bench.length}/7)</h3>
      <div class="list">
        ${A.bench.map((id, i) => row(P(id), 'bench', i)).join('')}
        ${A.bench.length < 7 ? `<button class="sq-empty ${isSel('bench', A.bench.length) ? 'sel' : ''}" data-kind="bench" data-idx="${A.bench.length}">+ Ajouter un remplaçant</button>` : ''}
      </div>

      <h3 class="section-title">Hors groupe (${reserves.length})</h3>
      <div class="list">${reserves.map((p) => row(p, 'res', p.id)).join('')}</div>
      <p class="small muted">Notes : EA SPORTS FC 27 quand disponibles, sinon estimées. Un joueur hors de son poste perd des points (badge orange).</p>`;
  },

  bind(root, { store, render }) {
    const onClick = (e) => {
      const pl = e.target.closest('[data-ctl="plan"]');
      if (pl) {
        store.update((s) => { s.teams.A.plan = pl.value; });
        toast(`Plan de jeu : ${PLANS[pl.value].label}`);
        return render();
      }
      const ctl = e.target.closest('[data-ctl="auto"]');
      if (ctl) {
        store.update((s) => {
          const A = s.teams.A;
          Object.assign(A, autoLineup(A.players.map((id) => s.players[id]), A.formation));
        });
        selected = null;
        toast('Composition automatique');
        render();
        return;
      }
      const el = e.target.closest('[data-kind]');
      if (!el) return;
      const target = { kind: el.dataset.kind, idx: el.dataset.kind === 'res' ? el.dataset.id : Number(el.dataset.idx), id: el.dataset.id };
      if (!selected) {
        if (!target.id) return;
        selected = target;
        render();
        return;
      }
      if (selected.kind === target.kind && selected.idx === target.idx) {
        selected = null;
        render();
        return;
      }
      store.update((s) => swap(s.teams.A, selected, target));
      selected = null;
      render();
    };
    const onChange = (e) => {
      const k = e.target.dataset.ctl;
      if (k === 'formation') {
        store.update((s) => {
          const A = s.teams.A;
          A.formation = e.target.value;
          Object.assign(A, autoLineup(A.players.map((id) => s.players[id]), A.formation));
        });
        render();
      } else if (k === 'tactic') {
        store.update((s) => { s.teams.A.tactic = e.target.value; });
        toast(`Tactique : ${TACTICS[e.target.value].label}`);
      }
    };
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
  },
};

function swap(A, a, b) {
  const get = (x) => (x.kind === 'starter' ? A.starters[x.idx] : x.kind === 'bench' ? A.bench[x.idx] : x.idx);
  const set = (x, id) => {
    if (x.kind === 'starter') A.starters[x.idx] = id;
    else if (x.kind === 'bench') {
      if (id == null) A.bench.splice(x.idx, 1);
      else A.bench[x.idx] = id;
    }
  };
  const ida = get(a);
  const idb = get(b);
  if (a.kind === 'res' && b.kind === 'res') return;
  if (a.kind === 'starter' && idb == null) return; // pas de trou dans le XI
  if (b.kind === 'starter' && ida == null) return;
  // Mise à jour du banc en dernier pour ne pas décaler les index
  const ops = [[a, idb], [b, ida]];
  ops.sort((x, y) => (x[0].kind === 'bench') - (y[0].kind === 'bench'));
  for (const [slot, id] of ops) set(slot, id ?? null);
  A.bench = A.bench.filter(Boolean);
}

function planCard(s, data) {
  const f = fixtureOfWeek(data, s.week);
  if (!f || s.seasonOver) return '';
  const club = clubById(data, f.opponent);
  const known = styleKnown(s);
  const A = s.teams.A;
  const pf = known ? planFactor(A.plan, club.style, s.staff?.analyste) : 1;
  const verdict = !known ? 'Style adverse inconnu : recrutez un analyste vidéo (niveau 2) pour le connaître.'
    : pf > 1 ? `✅ Votre plan contre ce style : +${Math.round((pf - 1) * 100)} % de force.`
    : pf < 1 ? `⚠️ Mauvais choix contre ce style : ${Math.round((pf - 1) * 100)} % de force.` : 'Plan neutre contre ce style.';
  return `
    <section class="card plan">
      <div class="card-head"><h3>Plan de jeu · J${s.week}</h3><span class="chip">${esc(club.short)}</span></div>
      <p class="small">Adversaire : <b>${esc(club.name)}</b>${known ? ` · style <b>${PLANS[club.style].label.toLowerCase()}</b>` : ''}</p>
      <div class="seg wide">${Object.entries(PLANS).map(([k, p]) => `<button class="${A.plan === k ? 'on' : ''}" data-ctl="plan" value="${k}">${p.label}</button>`).join('')}</div>
      <p class="small ${pf < 1 ? 'warn' : pf > 1 ? 'ok' : 'muted'}">${verdict}</p>
      <p class="small muted">Pressing bat possession, possession bat contre, contre bat pressing.</p>
      <div class="coh"><span class="small">Cohésion du groupe : <b>${Math.round(s.cohesion ?? 60)}</b>/100</span>${progressBar(s.cohesion ?? 60, 100)}
      <span class="small muted">Un XI stable soude le vestiaire (jusqu’à +5 % de force) ; les remaniements et les recrues la font baisser.</span></div>
    </section>`;
}
