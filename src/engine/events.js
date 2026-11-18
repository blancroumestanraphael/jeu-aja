// Messages des coachs et événements surprise.

import { overall, fullName } from './players.js';
import { addYouth } from './setup.js';

export const RIVAL_RISK = 0.25;
export const WAIT_WEEKS = 2;
export const SURPRISE_P = 0.25;

const NEXT_TEAM = { U15: 'U17', U17: 'U19' };
const COACH_OF = { U15: 'c_u15', U17: 'c_u17' };

export const isCoachCandidate = (p, week) =>
  overall(p) >= 65 || (p.potential >= 80 && week >= (p.noticeWeek ?? 0));

/** Au plus un nouveau message de coach par semaine. */
export function checkCoachMessages(save, rng) {
  const out = [];
  const candidates = [];
  for (const team of ['U17', 'U15']) {
    for (const id of save.teams[team].players) {
      const p = save.players[id];
      if (!save.proposedIds.includes(id) && isCoachCandidate(p, save.week)) candidates.push({ p, team });
    }
  }
  if (candidates.length) {
    const { p, team } = rng.pick(candidates);
    save.proposedIds.push(p.id);
    const msg = {
      id: `m_${save.week}_${p.id}`,
      kind: 'coach',
      week: save.week,
      coachId: COACH_OF[team],
      playerId: p.id,
      from: team,
      to: NEXT_TEAM[team],
      title: `${save.coaches[COACH_OF[team]].name} : « ${fullName(p)} est prêt »`,
      body: `${fullName(p)} (${p.age} ans, ${p.position}) — note ${overall(p)}, potentiel ${p.potential}. Je propose de le faire monter en ${NEXT_TEAM[team]}. Sinon, des clubs rivaux tournent autour…`,
      status: 'pending',
      waitUntil: save.week + WAIT_WEEKS,
      choices: ['accept', 'refuse', 'wait'],
    };
    save.messages.unshift(msg);
    out.push(msg);
  }
  return out;
}

/** Messages en attente trop longtemps : 25 % de risque par semaine qu'un rival recrute le jeune. */
export function resolveRivalRisk(save, rng) {
  const lost = [];
  for (const m of save.messages) {
    if (m.status !== 'pending' || save.week <= m.waitUntil) continue;
    if (m.kind === 'coach' && rng.chance(RIVAL_RISK)) {
      const p = save.players[m.playerId];
      removeFromTeams(save, m.playerId);
      m.status = 'lost';
      if (m.coachId && save.coaches[m.coachId]) save.coaches[m.coachId].trust = Math.max(0, save.coaches[m.coachId].trust - 10);
      lost.push(p);
      save.log.push({ week: save.week, text: `Trop tard : ${fullName(p)} a signé dans un club rival.` });
    }
  }
  return lost;
}

export function removeFromTeams(save, id) {
  for (const t of Object.values(save.teams)) {
    t.players = t.players.filter((x) => x !== id);
    if (t.starters) t.starters = t.starters.map((x) => (x === id ? null : x));
    if (t.bench) t.bench = t.bench.filter((x) => x !== id);
    if (t.playingTime) delete t.playingTime[id];
  }
  if (save.players[id]) save.players[id].team = 'PARTI';
}

export function movePlayer(save, id, to) {
  removeFromTeams(save, id);
  save.players[id].team = to;
  save.teams[to].players.push(id);
  if (to === 'U19') save.teams.U19.playingTime[id] = 'aucun';
}

/** Réponse du joueur à un message. Pure : renvoie un nouveau save. */
export function answerMessage(save0, messageId, choice, rng) {
  const save = structuredClone(save0);
  const m = save.messages.find((x) => x.id === messageId);
  if (!m || m.status !== 'pending') return save0;
  const p = m.playerId ? save.players[m.playerId] : null;
  const coach = m.coachId ? save.coaches[m.coachId] : null;

  if (m.kind === 'coach') {
    if (choice === 'accept') {
      movePlayer(save, p.id, m.to);
      m.status = 'accepted';
      if (coach) coach.trust = Math.min(100, coach.trust + 5);
      save.log.push({ week: save.week, text: `${fullName(p)} monte en ${m.to}.` });
    } else if (choice === 'refuse') {
      m.status = 'refused';
      if (coach) coach.trust = Math.max(0, coach.trust - 8);
    } else if (choice === 'wait') {
      m.waitUntil = save.week + WAIT_WEEKS;
      m.waited = true;
    }
  } else if (m.kind === 'rival') {
    if (choice === 'protect') {
      save.budget -= 2000;
      p.morale = Math.min(100, p.morale + 10);
      m.status = 'done';
      save.log.push({ week: save.week, text: `${fullName(p)} prolonge : contrat aspirant signé.` });
    } else {
      const leaves = rng.chance(0.5);
      m.status = leaves ? 'lost' : 'done';
      if (leaves) {
        removeFromTeams(save, p.id);
        save.log.push({ week: save.week, text: `${fullName(p)} quitte l’AJA pour un club rival.` });
      } else {
        save.log.push({ week: save.week, text: `${fullName(p)} reste fidèle à l’AJA.` });
      }
    }
  } else if (m.kind === 'sponsor') {
    const st = save.sponsors[m.sponsorId];
    if (choice === 'calm') {
      save.budget -= 1000;
      st.satisfaction = Math.min(100, st.satisfaction + 20);
      m.status = 'done';
    } else {
      st.satisfaction = Math.max(0, st.satisfaction - 10);
      m.status = 'done';
    }
  } else {
    m.status = 'done';
  }
  return save;
}

/** Événement surprise : 1 semaine sur 4. */
export function surpriseEvent(save, data, rng) {
  if (!rng.chance(SURPRISE_P)) return null;
  const types = ['rival', 'talent', 'sponsor'];
  let type = rng.pick(types);
  const signed = Object.entries(save.sponsors).filter(([, s]) => s.signed);
  if (type === 'sponsor' && signed.length === 0) type = 'talent';
  const u19 = save.teams.U19.players.map((id) => save.players[id]);
  if (type === 'rival' && u19.length === 0) type = 'talent';

  let msg;
  if (type === 'rival') {
    const p = u19.slice().sort((a, b) => b.potential - a.potential)[rng.int(0, Math.min(4, u19.length - 1))];
    msg = {
      id: `e_${save.season}_${save.week}`,
      kind: 'rival',
      week: save.week,
      playerId: p.id,
      title: `Un club rival vise ${fullName(p)}`,
      body: `Un club de Ligue 1 a contacté la famille de ${fullName(p)} (U19, potentiel ${p.potential}). Lui proposer un contrat aspirant coûte 2 000 €.`,
      status: 'pending',
      waitUntil: save.week + 99,
      choices: save.budget >= 2000 ? ['protect', 'letgo'] : ['letgo'],
    };
  } else if (type === 'talent') {
    const city = rng.pick(data.cities.cities);
    const p = addYouth(save, data, rng, { age: rng.int(14, 17), team: 'PROSPECT', cityId: city.id, potBonus: 10 });
    save.prospects.push({ playerId: p.id, cityId: city.id, partial: false, week: save.week });
    msg = {
      id: `e_${save.season}_${save.week}`,
      kind: 'info',
      week: save.week,
      playerId: p.id,
      title: `Talent caché à ${city.name}`,
      body: `On vous signale ${fullName(p)}, ${p.age} ans, à ${city.name}. Allez rencontrer ses parents avant les autres !`,
      status: 'pending',
      waitUntil: save.week + 99,
      choices: ['ok'],
    };
  } else {
    const [sid, st] = rng.pick(signed);
    const def = data.sponsors.sponsors.find((s) => s.id === sid);
    st.satisfaction = Math.max(0, st.satisfaction - 15);
    msg = {
      id: `e_${save.season}_${save.week}`,
      kind: 'sponsor',
      week: save.week,
      sponsorId: sid,
      title: `${def.name} est mécontent`,
      body: `${def.name} trouve que l’AJA ne le met pas assez en avant (satisfaction ${st.satisfaction}). Une opération de visibilité coûte 1 000 €.`,
      status: 'pending',
      waitUntil: save.week + 99,
      choices: save.budget >= 1000 ? ['calm', 'ignore'] : ['ignore'],
    };
  }
  save.messages.unshift(msg);
  return msg;
}

export const CHOICE_LABELS = {
  accept: 'Faire monter',
  refuse: 'Refuser',
  wait: 'Attendre 2 semaines',
  protect: 'Proposer un contrat (−2 000 €)',
  letgo: 'Laisser faire',
  calm: 'Opération visibilité (−1 000 €)',
  ignore: 'Ignorer',
  ok: 'Compris',
};
