// Club → Mercato : finances, marché des transferts (joueurs fictifs), offres reçues, prêts.
import { esc, clubNav, progressBar, stars, ratingBadge, openModal, closeModal, toast } from '../ui/components.js';
import { overall, fullName } from '../engine/players.js';
import { wageBill, wageDemand } from '../engine/contracts.js';
import { windowOf, WINDOWS, generateMarket, buyPlayer, loanOut, canLoan, raiseWageCap, squadValue, CAP_RAISE } from '../engine/mercato.js';
import { streamFor } from '../engine/rng.js';

export default {
  keepScroll: true,
  render({ store, data }) {
    const s = store.save;
    const w = windowOf(s.week);
    if (w && (!s.market?.players?.length || s.market.season !== s.season || windowOf(s.market.week) !== w)) generateMarket(s, data);
    const next = WINDOWS.find((x) => x.from > s.week);
    const bill = wageBill(s);
    const offers = s.messages.filter((m) => m.kind === 'offer' && m.status === 'pending');
    const loanable = [...s.teams.A.players, ...s.teams.U19.players].map((id) => s.players[id]).filter((p) => p.age >= 17 && p.age <= 23 && p.contract?.type !== 'pret')
      .sort((a, b) => b.potential - a.potential).slice(0, 8);
    const hist = s.finances.history.slice(-6).reverse();

    return `
      ${clubNav('mercato')}
      <section class="card ${w ? 'window-open' : ''}">
        <div class="card-head"><h3>${w ? `🟢 ${w.label} ouvert` : '🔴 Mercato fermé'}</h3><span class="chip">S${s.week}</span></div>
        <p class="small muted">${w ? `Jusqu’à la semaine ${w.to}. Achats, ventes et prêts possibles.` : next ? `Prochaine ouverture : ${next.label}, semaine ${next.from}.` : 'Réouverture la saison prochaine (semaines 1 à 3).'}</p>
      </section>

      <section class="card">
        <h3>Finances du club</h3>
        <div class="fin-grid">
          <div><b>${s.finances.transferBudget.toFixed(1)} M€</b><span>budget transferts</span></div>
          <div><b>${squadValue(s).toFixed(1)} M€</b><span>valeur de l’effectif</span></div>
          <div><b>${(s.budget / 1000).toFixed(1)} k€</b><span>budget du centre</span></div>
        </div>
        <p class="small">Masse salariale : ${bill.toFixed(1)} / ${s.wageCap} k€ par semaine</p>
        ${progressBar(bill, s.wageCap)}
        <div class="choices"><button class="btn btn-small" data-raise ${s.finances.transferBudget < CAP_RAISE.cost ? 'disabled' : ''}>Relever le plafond (+${CAP_RAISE.amount} k€/sem) : ${CAP_RAISE.cost} M€</button></div>
        <p class="small muted">Arbitrage : le budget transferts sert aux achats ou à augmenter la masse salariale (prolongations, recrues). Il est alimenté par les ventes et, en fin de saison, par les droits TV et la prime de classement.</p>
        ${hist.length ? `<ul class="log">${hist.map((h) => `<li><span class="muted">${esc(h.season)} S${h.week}</span> ${esc(h.type)}${h.player ? ` · ${esc(h.player)}` : ''} <b class="${h.amount >= 0 ? 'up' : 'down'}">${h.amount >= 0 ? '+' : ''}${h.amount.toFixed(1)} M€</b></li>`).join('')}</ul>` : ''}
      </section>

      ${offers.length ? `<a class="card alert" href="#/messages">💶 ${offers.length} offre(s) reçue(s) pour vos joueurs — répondre dans les messages</a>` : ''}

      <h3 class="section-title">Marché des transferts</h3>
      ${w ? `<p class="hint">Joueurs fictifs générés pour le jeu. Prix demandé indicatif : une offre trop basse est refusée, une offre proche appelle une contre-proposition.</p>
      <div class="list">${s.market.players.map((x) => `
        <button class="mk-row" data-buy="${x.player.id}">
          <span class="pos pos-${x.player.position}">${x.player.position}</span>
          <span class="pr-main"><span class="pr-name">${esc(fullName(x.player))}</span>
          <span class="pr-sub">${x.player.age} ans · ${stars(x.player.potential)} · ${esc(x.club)}</span></span>
          <span class="mk-price">${x.asking.toFixed(1)} M€<small>${wageDemand(x.player, 'rotation')} k€/sem</small></span>
          ${ratingBadge(overall(x.player))}
        </button>`).join('')}</div>` : '<p class="card muted">Le marché rouvrira avec la prochaine fenêtre.</p>'}

      <h3 class="section-title">Prêts</h3>
      ${s.loans.length ? `<div class="list">${s.loans.map((l) => { const p = s.players[l.playerId]; return `<a class="ctr-row" href="#/player/${p.id}"><span class="ctr-main"><span class="pos pos-${p.position}">${p.position}</span><span class="pr-main"><span class="pr-name">${esc(fullName(p))}</span><span class="pr-sub">prêté à ${esc(l.club)} · ${p.matchStats?.apps || 0} matchs · retour en juin</span></span></span>${ratingBadge(overall(p))}</a>`; }).join('')}</div>` : ''}
      <p class="hint">Prêter un jeune de 17 à 23 ans lui donne du temps de jeu de titulaire ailleurs ; il revient en fin de saison. Comparez les scénarios sur sa fiche.</p>
      <div class="list">${loanable.map((p) => `
        <div class="ctr-row"><a class="ctr-main" href="#/player/${p.id}"><span class="pos pos-${p.position}">${p.position}</span>
          <span class="pr-main"><span class="pr-name">${esc(fullName(p))}</span><span class="pr-sub">${p.team === 'A' ? 'Équipe 1' : 'U19'} · ${p.age} ans · ${stars(p.potential)} · ${p.minutesThisSeason}′ cette saison</span></span></a>
          <button class="btn btn-small" data-loan="${p.id}" ${canLoan(s, p).ok ? '' : 'disabled'}>Prêter</button></div>`).join('')}</div>`;
  },

  bind(root, { store, data, render }) {
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-raise]')) {
        const r = raiseWageCap(store.save);
        if (r.error) return toast(r.error);
        store.set(r.save); toast('Plafond salarial relevé'); return render();
      }
      const l = e.target.closest('[data-loan]');
      if (l) {
        const p = store.save.players[l.dataset.loan];
        if (!confirm(`Prêter ${fullName(p)} jusqu’à la fin de la saison ?`)) return;
        const r = loanOut(store.save, p.id, streamFor(store.save, 'loan', p.id));
        if (r.result.error) return toast(r.result.error);
        store.set(r.save); toast(`${fullName(p)} prêté à ${r.result.club}`); return render();
      }
      const b = e.target.closest('[data-buy]');
      if (b) buyDialog(store, b.dataset.buy, render);
    });
  },
};

function buyDialog(store, id, render) {
  const item = store.save.market.players.find((x) => x.player.id === id);
  const p = item.player;
  let fee = item.asking;
  let last = null;
  const view = () => `
    <div class="modal-head"><h3>${esc(fullName(p))}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <p class="small muted">${p.position} · ${p.age} ans · note ${overall(p)} · potentiel ${p.potential} · ${esc(item.club)} · joueur fictif</p>
    <p>Prix demandé : <b>${item.asking.toFixed(1)} M€</b> · valeur estimée ${item.value.toFixed(1)} M€ · salaire demandé ${wageDemand(p, 'rotation')} k€/sem</p>
    ${last ? `<p class="nego-reply ${last.outcome}">${esc(last.text)}</p>` : ''}
    ${last?.outcome === 'counter' ? `<button class="btn btn-gold" data-counter>Accepter : ${last.counter.toFixed(1)} M€</button>` : ''}
    ${last?.outcome === 'accept' ? '<button class="btn btn-primary" data-close>Fermer</button>' : `
    <label class="nego-l" for="fee">Votre offre : <b>${fee.toFixed(1)} M€</b> (budget ${store.save.finances.transferBudget.toFixed(1)} M€)</label>
    <input id="fee" type="range" min="${Math.max(0.1, Math.round(item.asking * 0.5 * 10) / 10)}" max="${Math.round(item.asking * 1.2 * 10) / 10}" step="0.1" value="${fee}">
    <button class="btn btn-primary btn-big" data-offer>Faire l’offre</button>`}`;
  openModal(view(), {
    onBind(el) {
      el.addEventListener('input', (e) => { if (e.target.id === 'fee') { fee = Number(e.target.value); el.querySelector('label[for="fee"] b').textContent = `${fee.toFixed(1)} M€`; } });
      el.addEventListener('click', (e) => {
        const amount = e.target.closest('[data-offer]') ? fee : e.target.closest('[data-counter]') ? last.counter : null;
        if (amount === null) return;
        const r = buyPlayer(store.save, id, amount);
        if (r.result.outcome === 'error') return toast(r.result.text);
        last = r.result;
        if (r.result.outcome === 'accept') { store.set(r.save); render(); toast('Transfert conclu ✍️'); }
        el.innerHTML = view();
      });
    },
  });
}
