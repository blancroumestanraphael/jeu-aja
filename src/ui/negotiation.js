// Fenêtre de négociation de contrat (offre, contre-offre, accord).
import { esc, openModal, toast } from './components.js';
import { fullName } from '../engine/players.js';
import { ROLES, agentBrief, makeOffer, wageBill, wageDemand, canNegotiate, MIN_WAGE } from '../engine/contracts.js';

export function openNegotiation(store, playerId, onDone) {
  const s0 = store.save;
  const p0 = s0.players[playerId];
  const can = canNegotiate(s0, p0);
  if (!can.ok) return toast(can.reason);
  const firstPro = p0.contract.type === 'formation';
  let role = firstPro ? 'remplacant' : 'rotation';
  let years = agentBrief(s0, p0, role).years;
  let wage = agentBrief(s0, p0, role).wage;
  let last = null;

  const view = () => {
    const s = store.save;
    const p = s.players[playerId];
    const b = agentBrief(s, p, role);
    const demand = wageDemand(p, role);
    const min = Math.max(MIN_WAGE * 0.5, Math.round(demand * 0.5 * 10) / 10);
    const max = Math.round(demand * 1.6 * 10) / 10;
    wage = Math.min(max, Math.max(min, wage));
    const bill = p.team === 'A' ? wageBill(s) - (p.contract.type === 'pro' ? p.contract.wage : 0) + wage : null;
    const closed = last && (last.outcome === 'accept' || !canNegotiate(s, p).ok);
    return `
      <div class="modal-head"><h3>${firstPro ? 'Premier contrat pro' : 'Prolongation'} · ${esc(fullName(p))}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
      <div class="agent">
        <span class="agent-i">🕴️</span>
        <p>« Pour un rôle de <b>${esc(ROLES[role].label.toLowerCase())}</b>, mon client attend autour de <b>${demand} k€/semaine</b> sur <b>${b.years} an${b.years > 1 ? 's' : ''}</b>.${p.isReal || p.freeAgent ? '' : ' Il a grandi au centre, il aime ce club.'} »</p>
      </div>
      ${last ? `<p class="nego-reply ${last.outcome}">${esc(last.text)}</p>` : ''}
      ${last?.outcome === 'counter' ? `<button class="btn btn-gold" data-accept-counter>Accepter : ${last.counter.wage} k€/sem · ${last.counter.years} an(s)</button>` : ''}
      ${closed ? '<button class="btn btn-primary" data-close>Fermer</button>' : `
      <label class="nego-l">Rôle promis</label>
      <div class="seg wide">${Object.entries(ROLES).map(([k, r]) => `<button class="${role === k ? 'on' : ''}" data-role="${k}">${esc(r.label)}</button>`).join('')}</div>
      <label class="nego-l" for="nego-wage">Salaire proposé : <b>${wage.toFixed(1)} k€ / semaine</b></label>
      <input id="nego-wage" type="range" min="${min}" max="${max}" step="0.1" value="${wage}">
      <label class="nego-l">Durée</label>
      <div class="seg wide">${[1, 2, 3, 4, 5].map((y) => `<button class="${years === y ? 'on' : ''}" data-years="${y}">${y} an${y > 1 ? 's' : ''}</button>`).join('')}</div>
      ${bill !== null ? `<p class="small ${bill > s.wageCap ? 'warn' : 'muted'}">Masse salariale après signature : ${bill.toFixed(1)} / ${s.wageCap} k€ par semaine</p>` : '<p class="small muted">Contrat d’un joueur du centre : hors masse salariale de l’équipe 1.</p>'}
      <p class="small muted">Offres restantes cette semaine : ${b.roundsLeft}. Une promesse « titulaire » non tenue fera baisser son moral.</p>
      <button class="btn btn-primary btn-big" data-offer>Faire l’offre</button>`}`;
  };

  openModal(view(), {
    onBind(el) {
      const refresh = () => { el.innerHTML = view(); };
      el.addEventListener('input', (e) => {
        if (e.target.id !== 'nego-wage') return;
        wage = Number(e.target.value);
        el.querySelector('label[for="nego-wage"] b').textContent = `${wage.toFixed(1)} k€ / semaine`;
      });
      el.addEventListener('change', (e) => { if (e.target.id === 'nego-wage') refresh(); });
      el.addEventListener('click', (e) => {
        const r = e.target.closest('[data-role]');
        if (r) { role = r.dataset.role; wage = wageDemand(store.save.players[playerId], role); return refresh(); }
        const y = e.target.closest('[data-years]');
        if (y) { years = Number(y.dataset.years); return refresh(); }
        const offer = e.target.closest('[data-offer]') ? { wage, years, role } : e.target.closest('[data-accept-counter]') ? last.counter : null;
        if (!offer) return;
        const { save, result } = makeOffer(store.save, playerId, offer);
        if (result.outcome === 'error') return toast(result.text);
        store.set(save);
        last = result;
        if (result.outcome === 'accept') { toast('Contrat signé ✍️'); onDone?.(); }
        refresh();
      });
    },
  });
}
