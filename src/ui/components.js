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
    <a href="#/team" class="${active === 'team' ? 'on' : ''}">Équipe 1</a>
    <a href="#/u19" class="${active === 'u19' ? 'on' : ''}">Centre de formation</a>
    <a href="#/table" class="${active === 'table' ? 'on' : ''}">Classement</a>
  </nav>`;

/** Barre de progression simple. */
export const progressBar = (value, target, cls = '') =>
  `<div class="supporter-progress ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value, target)}"><span style="width:${Math.min(100, (value / Math.max(1, target)) * 100)}%"></span></div>`;
