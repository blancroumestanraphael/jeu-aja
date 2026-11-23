// Club → Contrats : masse salariale, valeur de l'effectif, fins de contrat, jeunes à sécuriser.
import { esc, clubNav, progressBar, stars } from '../ui/components.js';
import { overall, fullName } from '../engine/players.js';
import { marketValue, wageBill, yearsLeft, seasonEndYear, ensureContracts } from '../engine/contracts.js';
import { openNegotiation } from '../ui/negotiation.js';

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    ensureContracts(s, data);
    const end = seasonEndYear(s.season);
    const A = s.teams.A.players.map((id) => s.players[id]);
    const bill = wageBill(s);
    const total = A.reduce((t, p) => t + marketValue(p, { yearsLeft: yearsLeft(s, p) }), 0);
    const sorted = A.slice().sort((a, b) => a.contract.until - b.contract.until || overall(b) - overall(a));
    const row = (p) => {
      const c = p.contract;
      const exp = c.until <= end;
      return `
        <div class="ctr-row ${exp ? 'exp' : ''}">
          <a class="ctr-main" href="#/player/${p.id}">
            <span class="pos pos-${p.position}">${p.position}</span>
            <span class="pr-main"><span class="pr-name">${esc(fullName(p))}</span>
              <span class="pr-sub">${p.age} ans · ${marketValue(p, { yearsLeft: yearsLeft(s, p) }).toFixed(1)} M€ · ${c.type === 'pret' ? `prêt (${esc(c.loanFrom)})` : `${c.wage} k€/sem`}</span></span>
            <span class="ctr-until ${exp ? 'exp' : ''}">${c.type === 'pret' ? 'prêt' : ''} ${c.until}</span>
          </a>
          ${c.type === 'pro' ? `<button class="btn btn-small" data-nego="${p.id}">Négocier</button>` : ''}
        </div>`;
    };
    const youth = s.teams.U19.players.map((id) => s.players[id]).filter((p) => p.contract?.type !== 'pro' && p.age >= 16)
      .sort((a, b) => b.potential - a.potential).slice(0, 6);
    const expCount = A.filter((p) => p.contract.until <= end && p.contract.type === 'pro').length;

    return `
      ${clubNav('contracts')}
      <section class="card">
        <div class="card-head"><h3>Masse salariale</h3><span class="chip">${bill.toFixed(1)} / ${s.wageCap} k€/sem</span></div>
        ${progressBar(bill, s.wageCap)}
        <div class="grid-2 ctr-sum">
          <div><b>${total.toFixed(1)} M€</b><span class="small muted">valeur estimée de l’effectif</span></div>
          <div><b class="${expCount ? 'warn' : ''}">${expCount}</b><span class="small muted">contrat(s) pro finissant en juin ${end}</span></div>
        </div>
        <p class="small muted">Sans prolongation, un joueur part libre en fin de saison ; un joueur prêté retourne dans son club. Valeurs et salaires : estimations du jeu ; fins de contrat réelles à confirmer avec le club.</p>
      </section>

      <h3 class="section-title">Équipe 1 — par date de fin de contrat</h3>
      <div class="list">${sorted.map(row).join('')}</div>

      <h3 class="section-title">🌱 Jeunes à sécuriser</h3>
      <p class="hint">Un premier contrat pro protège un U19 des clubs rivaux. Hors masse salariale de l’équipe 1.</p>
      <div class="list">${youth.map((p) => `
        <div class="ctr-row">
          <a class="ctr-main" href="#/player/${p.id}">
            <span class="pos pos-${p.position}">${p.position}</span>
            <span class="pr-main"><span class="pr-name">${esc(fullName(p))}</span><span class="pr-sub">${p.age} ans · ${stars(p.potential)} · note ${overall(p)}</span></span>
          </a>
          <button class="btn btn-small btn-primary" data-nego="${p.id}">Contrat pro</button>
        </div>`).join('') || '<p class="small muted">Tous vos U19 à potentiel sont sous contrat.</p>'}</div>`;
  },
  bind(root, { store, render }) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-nego]');
      if (b) openNegotiation(store, b.dataset.nego, render);
    });
  },
};
