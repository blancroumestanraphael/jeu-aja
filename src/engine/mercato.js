// Mercato (achats, ventes, offres reçues), prêts et finances du club.
// Les joueurs du marché sont FICTIFS (générés) : le jeu n'invente pas de transferts de vrais joueurs.

import { overall, fullName, fromRealPlayer, groupOf } from './players.js';
import { marketValue, wageDemand, wageBill, seasonEndYear, yearsLeft } from './contracts.js';
import { removeFromTeams } from './events.js';
import { streamFor } from './rng.js';

export const WINDOWS = [{ from: 1, to: 3, label: 'mercato d’été' }, { from: 17, to: 20, label: 'mercato d’hiver' }];
export const windowOf = (week) => WINDOWS.find((w) => week >= w.from && week <= w.to) || null;
export const CAP_RAISE = { cost: 1, amount: 5 }; // 1 M€ → +5 k€/semaine de masse salariale

const MARKET_CLUBS = ['un club de Ligue 2', 'un club belge', 'un club suisse', 'un club de National', 'un club portugais', 'un club néerlandais', 'un club de Ligue 1'];
const LOAN_CLUBS = ['un club de Ligue 2', 'un club de National', 'un club belge de D2', 'un club suisse'];
const POS = { GK: ['G'], DEF: ['DC', 'DC', 'DD', 'DG'], MIL: ['MDC', 'MC', 'MOC', 'MD', 'MG'], ATT: ['AD', 'AG', 'BU', 'BU'] };

/** Génère le marché d'une fenêtre (joueurs fictifs, prix demandés). */
export function generateMarket(save, data) {
  const rng = streamFor(save, 'market');
  const players = [];
  const groups = ['GK', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT', 'ATT', 'DEF', 'MIL', 'ATT'];
  groups.forEach((g, i) => {
    const age = rng.int(18, 31);
    const ovr = rng.int(62, 77) - (age <= 20 ? 4 : 0);
    const p = fromRealPlayer({
      id: `mk_${save.season}_${save.week}_${i}`, firstName: rng.pick(data.academy.firstNames), lastName: rng.pick(data.academy.lastNames),
      age, position: rng.pick(POS[g]), ovr, ovrSource: 'jeu',
    });
    p.isReal = false;
    p.freeAgent = true; // pas un formé du club
    p.potential = Math.max(ovr, Math.min(88, ovr + (age <= 21 ? rng.int(4, 12) : age <= 25 ? rng.int(0, 5) : 0)));
    const value = marketValue(p, { yearsLeft: 3 });
    players.push({ player: p, club: rng.pick(MARKET_CLUBS), asking: Math.max(0.2, Math.round(value * rng.range(1.05, 1.35) * 10) / 10), value });
  });
  save.market = { season: save.season, week: save.week, players };
  return save.market;
}

/** Offre d'achat. Renvoie { save, result: { outcome: accept|counter|refuse|error, text, counter } }. */
export function buyPlayer(save0, marketId, fee) {
  const w = windowOf(save0.week);
  if (!w) return { save: save0, result: { outcome: 'error', text: 'Le mercato est fermé (semaines 1-3 et 17-20).' } };
  const item = save0.market?.players.find((x) => x.player.id === marketId);
  if (!item) return { save: save0, result: { outcome: 'error', text: 'Joueur indisponible.' } };
  if (fee > save0.finances.transferBudget + 1e-9) return { save: save0, result: { outcome: 'error', text: `Budget transferts insuffisant (${save0.finances.transferBudget.toFixed(1)} M€).` } };
  const wage = wageDemand(item.player, 'rotation');
  if (wageBill(save0) + wage > save0.wageCap) return { save: save0, result: { outcome: 'error', text: `Masse salariale insuffisante : son salaire (${wage} k€/sem) dépasse le plafond.` } };
  const ratio = fee / item.asking;
  if (ratio < 0.8) return { save: save0, result: { outcome: 'refuse', text: `${item.club} refuse : « Offre irrecevable. »` } };
  if (ratio < 0.95) {
    const counter = Math.round(item.asking * 0.97 * 10) / 10;
    return { save: save0, result: { outcome: 'counter', counter, text: `${item.club} : « Pour ${counter.toFixed(1)} M€, on accepte. »` } };
  }
  const save = structuredClone(save0);
  const p = structuredClone(item.player);
  p.team = 'A';
  p.contract = { type: 'pro', until: seasonEndYear(save.season) + 3, wage, promise: 'rotation', source: 'jeu' };
  save.players[p.id] = p;
  save.teams.A.players.push(p.id);
  save.market.players = save.market.players.filter((x) => x.player.id !== marketId);
  save.finances.transferBudget = Math.round((save.finances.transferBudget - fee) * 10) / 10;
  save.finances.history.push({ season: save.season, week: save.week, type: 'achat', player: fullName(p), amount: -fee });
  save.cohesion = Math.max(0, (save.cohesion ?? 60) - 5);
  save.log.push({ week: save.week, text: `Mercato : ${fullName(p)} arrive de ${item.club} pour ${fee.toFixed(1)} M€.` });
  return { save, result: { outcome: 'accept', text: `${fullName(p)} signe à l’AJA (${fee.toFixed(1)} M€, ${wage} k€/sem jusqu’en ${p.contract.until}).` } };
}

/** Pendant le mercato : offres de clubs pour les joueurs de l'AJA (messages). */
export function generateOffers(save, rng) {
  if (!windowOf(save.week)) return [];
  const pool = save.teams.A.players.map((id) => save.players[id])
    .filter((p) => p.contract?.type === 'pro' && !save.messages.some((m) => m.kind === 'offer' && m.status === 'pending' && m.playerId === p.id));
  const out = [];
  const listed = pool.filter((p) => p.transferListed);
  const n = rng.chance(0.6) ? 1 : 0;
  for (let i = 0; i < n + listed.length && pool.length; i++) {
    const p = i < listed.length ? listed[i] : rng.weighted(pool, (x) => 1 + marketValue(x, { yearsLeft: yearsLeft(save, x) }));
    if (out.some((m) => m.playerId === p.id)) continue;
    const value = marketValue(p, { yearsLeft: yearsLeft(save, p) });
    const fee = Math.max(0.1, Math.round(value * rng.range(p.transferListed ? 0.8 : 0.9, 1.3) * 10) / 10);
    const club = rng.pick(MARKET_CLUBS);
    const msg = {
      id: `of_${save.season}_${save.week}_${p.id}`, kind: 'offer', week: save.week, playerId: p.id, fee, club,
      title: `Offre de ${fee.toFixed(1)} M€ pour ${fullName(p)}`,
      body: `${club[0].toUpperCase() + club.slice(1)} propose ${fee.toFixed(1)} M€ pour ${fullName(p)} (valeur estimée ${value.toFixed(1)} M€). L’offre expire à la fin du mercato.`,
      status: 'pending', waitUntil: windowOf(save.week).to, choices: ['sell', 'counterOffer', 'refuseOffer'],
    };
    save.messages.unshift(msg);
    out.push(msg);
  }
  return out;
}

/** Réponse à une offre reçue. */
export function answerOffer(save0, messageId, choice, rng) {
  const save = structuredClone(save0);
  const m = save.messages.find((x) => x.id === messageId);
  if (!m || m.status !== 'pending' || m.kind !== 'offer') return save0;
  const p = save.players[m.playerId];
  if (choice === 'refuseOffer') { m.status = 'refused'; return save; }
  let fee = m.fee;
  if (choice === 'counterOffer') {
    if (!rng.chance(0.5)) { m.status = 'refused'; m.body += ' Le club a refusé votre contre-proposition et se retire.'; save.log.push({ week: save.week, text: `${m.club} se retire pour ${fullName(p)}.` }); return save; }
    fee = Math.round(m.fee * 1.15 * 10) / 10;
  }
  removeFromTeams(save, p.id);
  m.status = 'done';
  m.body += ` Vendu ${fee.toFixed(1)} M€.`;
  save.finances.transferBudget = Math.round((save.finances.transferBudget + fee) * 10) / 10;
  save.finances.history.push({ season: save.season, week: save.week, type: 'vente', player: fullName(p), amount: fee });
  save.cohesion = Math.max(0, (save.cohesion ?? 60) - 3);
  save.log.push({ week: save.week, text: `Mercato : ${fullName(p)} vendu ${fee.toFixed(1)} M€ à ${m.club}.` });
  return save;
}

/** Fin de fenêtre : offres expirées. */
export function expireOffers(save) {
  for (const m of save.messages) if (m.kind === 'offer' && m.status === 'pending' && save.week > m.waitUntil) m.status = 'expired';
}

// --- Prêts ------------------------------------------------------------------------
export function canLoan(save, p) {
  if (!p || !['A', 'U19'].includes(p.team)) return { ok: false, reason: 'Seuls les joueurs de l’équipe 1 et les U19 peuvent être prêtés.' };
  if (p.contract?.type === 'pret') return { ok: false, reason: 'Ce joueur est déjà prêté à l’AJA.' };
  if (p.age < 17 || p.age > 23) return { ok: false, reason: 'Prêt réservé aux joueurs de 17 à 23 ans.' };
  if (!windowOf(save.week)) return { ok: false, reason: 'Les prêts se font pendant le mercato (semaines 1-3 et 17-20).' };
  return { ok: true };
}

/** Prête un jeune jusqu'à la fin de saison : il joue titulaire ailleurs et revient en juin. */
export function loanOut(save0, playerId, rng) {
  const p0 = save0.players[playerId];
  const can = canLoan(save0, p0);
  if (!can.ok) return { save: save0, result: { error: can.reason } };
  const save = structuredClone(save0);
  const p = save.players[playerId];
  const from = p.team;
  removeFromTeams(save, playerId);
  p.team = 'LOAN';
  const club = rng.pick(LOAN_CLUBS);
  save.loans.push({ playerId, club, from, season: save.season });
  save.log.push({ week: save.week, text: `${fullName(p)} est prêté à ${club} jusqu’à la fin de la saison.` });
  return { save, result: { club } };
}

/** Fin de saison : retour des prêtés dans leur équipe d'origine. */
export function returnLoans(save, lines = []) {
  for (const l of save.loans) {
    const p = save.players[l.playerId];
    if (!p || p.team !== 'LOAN') continue;
    p.team = l.from;
    save.teams[l.from].players.push(p.id);
    if (l.from === 'U19') save.teams.U19.playingTime[p.id] = 'aucun';
    lines.push(`${fullName(p)} revient de prêt (${l.club}).`);
  }
  save.loans = [];
  return lines;
}

// --- Finances ----------------------------------------------------------------------
/** Arbitrage : utiliser du budget transferts pour relever le plafond de masse salariale. */
export function raiseWageCap(save0) {
  if (save0.finances.transferBudget < CAP_RAISE.cost) return { save: save0, error: 'Budget transferts insuffisant.' };
  const save = structuredClone(save0);
  save.finances.transferBudget = Math.round((save.finances.transferBudget - CAP_RAISE.cost) * 10) / 10;
  save.wageCap += CAP_RAISE.amount;
  save.finances.history.push({ season: save.season, week: save.week, type: 'masse salariale', player: '', amount: -CAP_RAISE.cost });
  return { save };
}

export const squadValue = (save) => save.teams.A.players.reduce((t, id) => t + marketValue(save.players[id], { yearsLeft: yearsLeft(save, save.players[id]) }), 0);
export { groupOf, overall };
