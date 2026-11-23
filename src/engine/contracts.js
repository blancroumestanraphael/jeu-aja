// Contrats : valeur marchande, salaires, négociation (offre / contre-offre), promesses de temps de jeu, fins de contrat.
// Toutes les valeurs sont des ESTIMATIONS du jeu (pas de données Transfermarkt).

import { overall, fullName } from './players.js';

export const MAX_ROUNDS = 3; // offres possibles par joueur et par semaine
export const MIN_WAGE = 1.0; // k€ / semaine (premier contrat pro)
export const YOUTH_WAGE = 0.3; // contrat aspirant/stagiaire, hors masse salariale
export const ROLES = {
  titulaire: { label: 'Titulaire', demand: 1.1 },
  rotation: { label: 'Joueur de rotation', demand: 1.0 },
  remplacant: { label: 'Remplaçant', demand: 0.9 },
};

export const seasonEndYear = (season) => Number(season.split('-')[0]) + 1;

// Facteur d'âge continu (pas de palier brutal d'une année sur l'autre)
const AGE_CURVE = [[18, 1.4], [21, 1.35], [26, 1.1], [29, 0.9], [31, 0.6], [34, 0.3]];
function lerpAge(age) {
  if (age <= AGE_CURVE[0][0]) return AGE_CURVE[0][1];
  for (let i = 1; i < AGE_CURVE.length; i++) {
    const [a1, f1] = AGE_CURVE[i];
    const [a0, f0] = AGE_CURVE[i - 1];
    if (age <= a1) return f0 + ((age - a0) / (a1 - a0)) * (f1 - f0);
  }
  return AGE_CURVE[AGE_CURVE.length - 1][1];
}

/** Valeur marchande estimée (M€). */
export function marketValue(p, { ovr = overall(p), age = p.age, yearsLeft = 2 } = {}) {
  const base = 0.1 * 1.2 ** (ovr - 50);
  const ageF = lerpAge(age);
  // Le potentiel compte d'autant plus que le joueur est jeune (effet nul à 27 ans)
  const potF = 1 + Math.max(0, p.potential - ovr) * 0.04 * Math.max(0, Math.min(1, (27 - age) / 7));
  const contractF = yearsLeft <= 1 ? 0.6 : yearsLeft === 2 ? 0.85 : 1;
  return Math.round(base * ageF * potF * contractF * 10) / 10;
}

/** Salaire demandé (k€ / semaine), avant négociation. */
export function wageDemand(p, role = 'rotation') {
  const ovr = overall(p);
  const base = 1.0 * 1.1 ** (ovr - 55);
  const ageF = p.age >= 30 ? 0.9 : p.age <= 21 ? 0.85 : 1;
  const formed = p.isReal || p.freeAgent ? 1 : 0.85; // un formé au club est attaché à l'AJA
  const mood = 1 + (60 - (p.morale ?? 60)) / 300; // un joueur mécontent demande plus
  return Math.max(MIN_WAGE, Math.round(base * ageF * formed * mood * ROLES[role].demand * 10) / 10);
}

/** Durée préférée (années) selon l'âge et le potentiel. */
export function preferredYears(p) {
  if (p.age >= 30) return 3; // sécurité
  if (p.age <= 23 && p.potential - overall(p) >= 6) return 2; // garde des options
  return 4;
}

export const yearsLeft = (save, p) => (p.contract ? p.contract.until - seasonEndYear(save.season) + 1 : 0);
export const wageBill = (save) => save.teams.A.players.reduce((t, id) => t + (save.players[id].contract?.type === 'pro' ? save.players[id].contract.wage : 0), 0);

function newContract(type, until, wage, extra = {}) {
  return { type, until, wage, promise: null, ...extra };
}

/** Attribue un contrat aux joueurs qui n'en ont pas (création de partie, anciennes sauvegardes). */
export function ensureContracts(save, data) {
  const end = seasonEndYear(save.season);
  const real = Object.fromEntries((data?.players?.players || []).map((r) => [r.id, r]));
  for (const p of Object.values(save.players)) {
    if (p.contract || p.team === 'PARTI') continue;
    if (p.team === 'A') {
      const r = real[p.id];
      const until = r?.contractUntil ?? end + 2;
      const wage = wageDemand({ ...p, morale: 60 }, 'rotation');
      p.contract = r?.loanFrom
        ? newContract('pret', until, wage, { loanFrom: r.loanFrom, source: 'pret' })
        : newContract('pro', until, wage, { source: r ? r.contractSource || 'estime' : 'jeu' });
    } else if (['U19', 'U17', 'U15'].includes(p.team)) {
      p.contract = newContract('formation', end + (18 - Math.min(18, p.age)), YOUTH_WAGE, { source: 'jeu' });
    }
  }
  if (save.wageCap == null) save.wageCap = Math.round(wageBill(save) * 1.12);
  save.negotiations ||= {};
  return save;
}

export function canNegotiate(save, p) {
  if (!p?.contract) return { ok: false, reason: 'Pas de contrat.' };
  if (p.contract.type === 'pret') return { ok: false, reason: `Prêté par ${p.contract.loanFrom} : il retournera dans son club en fin de saison.` };
  if (!['A', 'U19'].includes(p.team)) return { ok: false, reason: 'Seuls les joueurs de l’équipe 1 et les U19 peuvent signer un contrat pro.' };
  if (p.team === 'U19' && p.age < 16) return { ok: false, reason: 'Trop jeune pour un contrat professionnel.' };
  const n = save.negotiations?.[p.id];
  if (n && n.key === `${save.season}:${save.week}` && (n.rounds >= MAX_ROUNDS || n.closed)) {
    return { ok: false, reason: 'Son agent ne reprendra contact que la semaine prochaine.' };
  }
  return { ok: true };
}

/** Ce que l'agent annonce avant de négocier. */
export function agentBrief(save, p, role = 'rotation') {
  return {
    wage: wageDemand(p, role),
    years: preferredYears(p),
    value: marketValue(p, { yearsLeft: yearsLeft(save, p) }),
    roundsLeft: MAX_ROUNDS - ((save.negotiations?.[p.id]?.key === `${save.season}:${save.week}`) ? save.negotiations[p.id].rounds : 0),
  };
}

/**
 * Fait une offre. offer = { wage (k€/sem), years (1..5), role }.
 * Renvoie { save, result: { outcome: 'accept'|'counter'|'refuse'|'error', text, counter? } }.
 */
export function makeOffer(save0, playerId, offer) {
  const p0 = save0.players[playerId];
  const can = canNegotiate(save0, p0);
  if (!can.ok) return { save: save0, result: { outcome: 'error', text: can.reason } };
  const save = structuredClone(save0);
  ensureContracts(save);
  const p = save.players[playerId];
  const key = `${save.season}:${save.week}`;
  const n = save.negotiations[playerId]?.key === key ? save.negotiations[playerId] : { key, rounds: 0, closed: false };
  save.negotiations[playerId] = n;
  n.rounds++;

  const years = Math.max(1, Math.min(5, Math.round(offer.years)));
  const role = ROLES[offer.role] ? offer.role : 'rotation';
  const isFirstPro = p.contract.type === 'formation';
  // Masse salariale (équipe 1) : la nouvelle offre remplace l'ancien salaire
  const current = p.contract.type === 'pro' && p.team === 'A' ? p.contract.wage : 0;
  if (p.team === 'A' && wageBill(save) - current + offer.wage > save.wageCap) {
    n.rounds--;
    return { save: save0, result: { outcome: 'error', text: `Masse salariale dépassée : ${(wageBill(save) - current + offer.wage).toFixed(1)} / ${save.wageCap} k€ par semaine.` } };
  }

  const demand = wageDemand(p, role);
  const pref = preferredYears(p);
  const ratio = offer.wage / demand;
  const durationFit = -0.04 * Math.abs(years - pref);
  const loyalty = p.isReal || p.freeAgent ? 0 : 0.06; // formé à l'AJA
  const roleFit = role === 'titulaire' ? 0.04 : role === 'remplacant' && overall(p) >= 70 ? -0.06 : 0;
  const score = ratio + durationFit + loyalty + roleFit + ((p.morale ?? 60) - 60) / 500;
  const name = fullName(p);

  if (score >= 1) {
    const until = seasonEndYear(save.season) + years - 1;
    p.contract = { type: 'pro', until, wage: Math.round(offer.wage * 10) / 10, promise: role, source: 'jeu', signedSeason: save.season };
    p.morale = Math.min(100, (p.morale ?? 60) + 6);
    n.closed = true;
    save.log.push({ week: save.week, text: `${name} ${isFirstPro ? 'signe son premier contrat pro' : 'prolonge'} jusqu’en ${until} (${p.contract.wage} k€/sem).` });
    return { save, result: { outcome: 'accept', text: `Marché conclu ! ${name} s’engage jusqu’en ${until}${role === 'titulaire' ? ' — il compte sur une place de titulaire' : ''}.` } };
  }
  if (score >= 0.88 && n.rounds < MAX_ROUNDS) {
    // Contre-proposition : salaire qui ferait passer le score à 1 avec la durée préférée
    const need = Math.max(offer.wage, Math.ceil((1 - (loyalty + roleFit + ((p.morale ?? 60) - 60) / 500)) * demand * 10) / 10);
    const counter = { wage: need, years: pref, role };
    n.counter = counter;
    return { save, result: { outcome: 'counter', counter, text: `L’agent de ${name} : « On y est presque. À ${need} k€ par semaine sur ${pref} an${pref > 1 ? 's' : ''}, on signe. »` } };
  }
  p.morale = Math.max(10, (p.morale ?? 60) - 3);
  if (n.rounds >= MAX_ROUNDS) n.closed = true;
  return {
    save,
    result: {
      outcome: 'refuse',
      text: n.closed
        ? `L’agent de ${name} met fin aux discussions pour cette semaine. Le joueur est un peu vexé (moral −3).`
        : `L’agent de ${name} : « Ce n’est pas sérieux. » (moral −3). Il vous reste ${MAX_ROUNDS - n.rounds} offre(s) cette semaine.`,
    },
  };
}

/** Promesses de temps de jeu : un titulaire promis qui ne joue pas perd du moral. */
export function checkPromises(save) {
  const A = save.teams.A;
  const broken = [];
  for (const id of A.players) {
    const p = save.players[id];
    const promise = p.contract?.promise;
    if (promise === 'titulaire' && !A.starters.includes(id)) { p.morale = Math.max(10, p.morale - 3); broken.push(p); }
    if (promise === 'rotation' && !A.starters.includes(id) && !A.bench.includes(id)) { p.morale = Math.max(10, p.morale - 2); broken.push(p); }
  }
  return broken;
}

/** Contrats qui se terminent à la fin de la saison en cours (équipe 1). */
export const expiringContracts = (save) =>
  save.teams.A.players.map((id) => save.players[id]).filter((p) => p.contract && p.contract.until <= seasonEndYear(save.season));
