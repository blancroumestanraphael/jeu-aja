// Composants réutilisables : carte joueur, jauge, étoiles, modale, toast.

import { overall, potentialStars, fullName, ATTRS, ATTR_LABELS } from '../engine/players.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const euro = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export function stars(pot, { hidden = false } = {}) {
  if (hidden) return '<span class="stars muted">? ? ?</span>';
  const n = potentialStars(pot);
  return `<span class="stars" aria-label="${n} étoiles sur 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
}

export function ratingClass(r) {
  if (r >= 75) return 'r-elite';
  if (r >= 68) return 'r-good';
  if (r >= 58) return 'r-ok';
  return 'r-low';
}

export function ratingBadge(r, extra = '') {
  return `<span class="rating ${ratingClass(r)} ${extra}">${Math.round(r)}</span>`;
}

export function gauge(label, value, max = 100, { potential = null, hidden = false } = {}) {
  const v = Math.round(value);
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const potPct = potential ? Math.min(100, (potential / max) * 100) : null;
  return `
    <div class="gauge">
      <div class="gauge-head"><span>${esc(label)}</span><strong>${hidden ? '?' : v}</strong></div>
      <div class="gauge-track">
        ${potPct ? `<div class="gauge-pot" style="width:${potPct}%"></div>` : ''}
        <div class="gauge-fill ${ratingClass(value)}" style="width:${hidden ? 0 : pct}%"></div>
      </div>
    </div>`;
}

export function moraleIcon(m) {
  if (m >= 80) return '<span title="Moral excellent">😄</span>';
  if (m >= 60) return '<span title="Bon moral">🙂</span>';
  if (m >= 40) return '<span title="Moral moyen">😐</span>';
  return '<span title="Moral bas">😟</span>';
}

export function playerRow(p, { right = '', action = 'open-player', hidden = false, sub = '' } = {}) {
  const ovr = overall(p);
  return `
    <button class="player-row" data-action="${action}" data-id="${esc(p.id)}">
      <span class="pos pos-${esc(p.position)}">${esc(p.position)}</span>
      <span class="pr-main">
        <span class="pr-name">${esc(fullName(p))}${p.isReal ? '' : ''}</span>
        <span class="pr-sub">${sub || `${p.age} ans · ${stars(p.potential, { hidden })} · ${moraleIcon(p.morale)}`}</span>
      </span>
      ${right}
      ${hidden ? '<span class="rating r-ok">?</span>' : ratingBadge(ovr)}
    </button>`;
}

export function attrGauges(p, { hidden = false } = {}) {
  return ATTRS.map((k) => gauge(ATTR_LABELS[k], p.attributes[k], 100, { potential: p.potential, hidden: hidden && (k === 'mental' || k === 'vision') })).join('');
}

// --- Modale ------------------------------------------------------------------
export function openModal(html, { onBind, dismissable = true } = {}) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  if (dismissable) {
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) closeModal();
    });
  }
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  onBind?.(wrap.querySelector('.modal'));
  return wrap;
}

export function closeModal() {
  document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
}

// --- Toast -------------------------------------------------------------------
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

/** Petit graphique d'évolution (SVG). */
export function sparkline(history, { w = 300, h = 70 } = {}) {
  if (!history || history.length < 2) return '<p class="muted small">L’évolution s’affichera après quelques semaines.</p>';
  const vals = history.map((x) => x[1]);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (w - 8) + 4},${h - 4 - ((v - min) / (max - min)) * (h - 8)}`).join(' ');
  return `
    <svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Évolution de la note de ${vals[0]} à ${vals[vals.length - 1]}">
      <polyline points="${pts}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="spark-legend"><span>${vals[0]}</span><span>${vals[vals.length - 1]}</span></div>`;
}

export const crest = (size = 36) => `
  <svg width="${size}" height="${size}" viewBox="0 0 40 46" aria-hidden="true">
    <path d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z" fill="#fff" stroke="var(--blue)" stroke-width="3"/>
    <path d="M20 6 L33 10.5 V22 C33 30 27 36 20 39.5 Z" fill="var(--blue)"/>
    <text x="20" y="27" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" stroke="var(--blue)" stroke-width="0.6" font-family="system-ui">AJA</text>
  </svg>`;

/** Sous-navigation de l'onglet Club. */
export const clubNav = (active) => `
  <nav class="subnav" aria-label="Club">
    <a href="#/team" class="${active === 'team' ? 'on' : ''}">Équipe</a>
    <a href="#/u19" class="${active === 'u19' ? 'on' : ''}">Formation</a>
    <a href="#/mercato" class="${active === 'mercato' ? 'on' : ''}">Mercato</a>
    <a href="#/contracts" class="${active === 'contracts' ? 'on' : ''}">Contrats</a>
    <a href="#/table" class="${active === 'table' ? 'on' : ''}">Ligue 1</a>
  </nav>`;

/** Barre de progression simple. */
export const progressBar = (value, target, cls = '') =>
  `<div class="supporter-progress ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value, target)}"><span style="width:${Math.min(100, (value / Math.max(1, target)) * 100)}%"></span></div>`;

/**
 * Graphique d'évolution : trait plein = évolution réelle, pointillés = projection.
 * real : [{ v, label? }], proj : [{ v, label }], potential : nombre (ligne de référence).
 */
export function evolutionChart({ real, proj, potential = null, realCaption = 'Saison en cours', projCaption = 'Projection 4 ans', unit = '' }) {
  const W = 320, H = 190, padL = 10, padR = 34, padT = 26, padB = 34;
  const split = padL + (W - padL - padR) * 0.5;
  const values = [...real.map((r) => r.v), ...proj.map((p) => p.v), ...(potential ? [potential] : [])];
  let min = Math.min(...values), max = Math.max(...values);
  if (max - min < 6) { const mid = (max + min) / 2; min = mid - 3; max = mid + 3; }
  min -= 1; max += 1;
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  // Réel : de padL à split ; projection : de split à W - padR
  const rx = (i) => (real.length === 1 ? split - 14 : padL + 8 + (i / (real.length - 1)) * (split - padL - 22));
  const px = (i) => split + ((i + 1) / proj.length) * (W - padR - split - 6);
  const realPts = real.map((r, i) => [rx(i), y(r.v)]);
  const last = realPts[realPts.length - 1];
  const projPts = [last, ...proj.map((p, i) => [px(i), y(p.v)])];
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const showRealDots = real.length <= 14;
  const lastProj = proj[proj.length - 1];
  const fmt = (v) => `${Math.round(v * 10) / 10}${unit}`;
  const trend = lastProj ? lastProj.v - real[real.length - 1].v : 0;
  return `
    <figure class="evo">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution réelle de ${fmt(real[0].v)} à ${fmt(real[real.length - 1].v)}, projection à ${lastProj ? fmt(lastProj.v) : '–'} dans ${proj.length} ans">
        <line x1="${split}" y1="${padT - 14}" x2="${split}" y2="${H - padB}" class="evo-split"/>
        <line x1="${padL}" y1="${H - padB}" x2="${W - 4}" y2="${H - padB}" class="evo-axis"/>
        ${potential ? `<line x1="${padL}" y1="${y(potential)}" x2="${W - padR + 4}" y2="${y(potential)}" class="evo-pot"/>
          <text x="${padL}" y="${y(potential) - 4}" text-anchor="start" class="evo-pot-t">potentiel ${potential}</text>` : ''}
        <path d="${path(projPts)}" class="evo-proj"/>
        ${proj.map((p, i) => `<circle cx="${px(i)}" cy="${y(p.v)}" r="4" class="evo-proj-dot"><title>${esc(p.label)} : ${fmt(p.v)}</title></circle>`).join('')}
        ${real.length > 1 ? `<path d="${path(realPts)}" class="evo-real"/>` : ''}
        ${showRealDots ? realPts.slice(0, -1).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" class="evo-real-dot"/>`).join('') : ''}
        <circle cx="${last[0]}" cy="${last[1]}" r="6" class="evo-now"/>
        <text x="${last[0] - 4}" y="${last[1] - 11}" text-anchor="middle" class="evo-lbl">${fmt(real[real.length - 1].v)}</text>
        ${real.length > 1 && Math.round(real[0].v) !== Math.round(real[real.length - 1].v) ? `<text x="${realPts[0][0]}" y="${realPts[0][1] + 16}" text-anchor="start" class="evo-lbl-s">${fmt(real[0].v)}</text>` : ''}
        ${lastProj ? `<text x="${px(proj.length - 1)}" y="${y(lastProj.v) - 10}" text-anchor="middle" class="evo-lbl proj">${fmt(lastProj.v)}</text>` : ''}
        ${proj.map((p, i) => `<text x="${px(i)}" y="${H - padB + 13}" text-anchor="middle" class="evo-tick">${esc(p.label)}</text>`).join('')}
        <text x="${padL}" y="${H - 6}" class="evo-cap">${esc(realCaption)}</text>
        <text x="${split + 6}" y="${H - 6}" class="evo-cap">${esc(projCaption)}</text>
      </svg>
      <figcaption class="evo-legend">
        <span><i class="lg-real"></i>Réel</span>
        <span><i class="lg-proj"></i>Projection (âge, potentiel, temps de jeu)</span>
        ${lastProj ? `<b class="${trend > 0.05 ? 'up' : trend < -0.05 ? 'down' : ''}">${trend > 0 ? '+' : ''}${unit ? fmt(trend) : Math.round(trend)} en ${proj.length} ans</b>` : ''}
      </figcaption>
    </figure>`;
}

const SC_COLORS = ['#0a3d91', '#3d86d0', '#9aa5b8', '#e3a400'];
/** Plusieurs scénarios de trajectoire (lignes) depuis la note actuelle. */
export function scenarioChart({ current, scenarios, potential, chosen }) {
  const W = 320, H = 170, padL = 30, padR = 54, padT = 14, padB = 26;
  const vals = [current, potential, ...scenarios.flatMap((s) => s.points.map((p) => p.ovrExact))];
  let min = Math.floor(Math.min(...vals)) - 1, max = Math.ceil(Math.max(...vals)) + 1;
  const n = scenarios[0].points.length;
  const x = (i) => padL + (i / n) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const lines = scenarios.map((s, k) => {
    const pts = [[x(0), y(current)], ...s.points.map((p, i) => [x(i + 1), y(p.ovrExact)])];
    const last = s.points[n - 1];
    const on = s.id === chosen;
    return `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${SC_COLORS[k % 4]}" stroke-width="${on ? 3.5 : 2}" ${on ? '' : 'stroke-dasharray="5 4"'} stroke-linecap="round"/>
      <text x="${W - padR + 4}" y="${y(last.ovrExact) + 4}" class="sc-end" fill="${SC_COLORS[k % 4]}">${Math.round(last.ovrExact)}</text>`;
  }).join('');
  const ticks = scenarios[0].points.map((p, i) => `<text x="${x(i + 1)}" y="${H - 8}" text-anchor="middle" class="evo-tick">${p.age} ans</text>`).join('');
  return `
    <figure class="evo">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scénarios de trajectoire sur ${n} saisons">
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="evo-axis"/>
        ${potential ? `<line x1="${padL}" y1="${y(potential)}" x2="${W - padR}" y2="${y(potential)}" class="evo-pot"/><text x="${padL}" y="${y(potential) - 4}" class="evo-pot-t">potentiel ${potential}</text>` : ''}
        <circle cx="${x(0)}" cy="${y(current)}" r="5" class="evo-now"/>
        <text x="${x(0) - 6}" y="${y(current) + 4}" text-anchor="end" class="evo-lbl">${Math.round(current)}</text>
        ${lines}${ticks}
      </svg>
      <figcaption class="evo-legend">${scenarios.map((s, k) => `<span><i style="border-top:3px ${s.id === chosen ? 'solid' : 'dashed'} ${SC_COLORS[k % 4]}"></i>${esc(s.label)}${s.id === chosen ? ' (actuel)' : ''}</span>`).join('')}</figcaption>
    </figure>`;
}

export const availabilityBadge = (p) => (p.injury ? `<span class="tag-inj" title="${esc(p.injury.label)}">🚑 ${p.injury.weeks} sem.</span>` : p.suspension > 0 ? '<span class="tag-inj">🟥 suspendu</span>' : '');
