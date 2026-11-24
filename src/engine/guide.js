// « Toujours une prochaine étape » : objectifs du jour, rappels intelligents, agenda des événements.
import { dailyQuestionId, WEEKLY_CHALLENGES, challengeKey, levelFor } from './community.js';
import { weeklyQuiz, localMissionOf } from './collection.js';
import { canPlayKeyMatch } from './keymatch.js';
import { windowOf, WINDOWS } from './mercato.js';

const missionDone = (s, id) => !!s.community?.missionsDone?.[id];

/** Objectifs du jour, triés par priorité. Chaque objectif : { id, icon, title, href|action, done }. */
export function dailyObjectives(s, data, today) {
  const c = s.community;
  const out = [];
  out.push({ id: 'pack', icon: '🃏', title: 'Ouvrir la carte du jour', action: 'pack', done: s.collection?.lastPack === today });
  out.push({ id: 'daily', icon: '📜', title: 'Répondre à la question du jour', href: '#/home', done: c.daily?.date === today && c.daily.answered });
  const { key, qids } = weeklyQuiz(data, today);
  const answered = Object.keys(s.collection?.weekly?.[key]?.answers || {}).length;
  out.push({ id: 'weekly', icon: '🧠', title: `Quiz de la semaine (${answered}/${qids.length})`, href: '#/heritage', done: answered >= qids.length });
  const nextCity = data.cities.cities.find((x) => !missionDone(s, x.id));
  if (nextCity && s.travelPointsLeft > 0) out.push({ id: 'mission', icon: '📍', title: `Mission à ${nextCity.name}`, href: `#/map/${nextCity.id}`, done: false });
  else if (s.travelPointsLeft > 0) {
    const city = data.cities.cities.find((x) => !s.collection?.localMissions?.[localMissionOf(s, data, x.id).key]);
    if (city) out.push({ id: 'local', icon: '⚽', title: `Mission locale à ${city.name}`, href: `#/map/${city.id}`, done: false });
  }
  const claimable = WEEKLY_CHALLENGES.filter((ch) => { const [v, t] = ch.progress(c.weekly); return v >= t && !c.claimedChallenges.includes(challengeKey(s, ch.id)); }).length;
  if (claimable) out.push({ id: 'claim', icon: '🎁', title: `Récupérer ${claimable} défi(s) de la semaine`, href: '#/supporter', done: false });
  const pending = s.messages.filter((m) => m.status === 'pending').length;
  if (pending) out.push({ id: 'messages', icon: '📨', title: `${pending} message(s) en attente`, href: '#/messages', done: false });
  if (canPlayKeyMatch(s, data).ok) out.push({ id: 'key', icon: '⭐', title: 'Jouer le Match de la veille', href: '#/match/veille', done: false });
  if (windowOf(s.week)) out.push({ id: 'mercato', icon: '💶', title: 'Mercato ouvert : renforcer l’effectif', href: '#/mercato', done: false });
  out.push({ id: 'week', icon: '▶️', title: s.seasonOver ? 'Lancer la saison suivante' : `Jouer la semaine ${s.week}`, href: '#/home', done: false });
  return out;
}

/** La prochaine étape la plus utile (premier objectif non fait). */
export const nextStep = (s, data, today) => dailyObjectives(s, data, today).find((o) => !o.done);

/** Rappels intelligents (au lancement). */
export function reminders(s, data, today, now = new Date()) {
  const out = [];
  const c = s.community;
  const yesterday = new Date(new Date(today + 'T12:00:00').getTime() - 86400000).toISOString().slice(0, 10);
  const streak = c.activeDays.includes(yesterday);
  if (streak && c.activeDays.length >= 2) out.push({ icon: '🔥', text: 'Votre série continue : revenez demain pour la prolonger.' });
  const real = data.fixtures.fixtures.find((f) => f.realDate >= today);
  if (real) {
    const days = Math.round((new Date(real.realDate + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
    const opp = data.clubs.clubs.find((x) => x.id === real.opponent)?.name;
    if (days === 1 && real.isKeyMatch) out.push({ icon: '⭐', text: `Ce soir de 18 h à minuit : Match de la veille contre ${opp} !`, href: '#/home' });
    else if (days <= 2) out.push({ icon: '📅', text: `AJA – ${opp} ${days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : 'dans 2 jours'}.` });
  }
  const day = now.getDay();
  if (day === 1) out.push({ icon: '🧠', text: 'Nouveau quiz de la semaine disponible.', href: '#/heritage' });
  if (day === 0) out.push({ icon: '⌛', text: 'Dernier jour pour finir le quiz de la semaine.', href: '#/heritage' });
  return out;
}

/** Agenda : rendez-vous quotidiens, hebdomadaires et saisonniers. */
export function agenda(s, data, today, serverEvents = []) {
  const realNext = data.fixtures.fixtures.filter((f) => f.realDate >= today).slice(0, 6);
  return {
    daily: [
      { icon: '🃏', title: 'Carte du jour', text: 'Une carte de l’histoire de l’AJA à chaque visite.' },
      { icon: '📜', title: 'Question du jour', text: 'Une question sur l’histoire du club, vérifiée par le serveur.' },
      { icon: '🔥', title: 'Série de visites', text: 'Revenez chaque jour pour allonger votre série.' },
    ],
    weekly: [
      { icon: '🧠', title: 'Quiz de la semaine', text: '5 questions, renouvelées chaque lundi, identiques pour tous.' },
      { icon: '🎯', title: 'Défis de la semaine', text: '4 objectifs personnels (Yonne, formation, patrimoine).' },
      { icon: '⚽', title: 'Missions locales', text: 'Une mission par commune et par semaine de jeu.' },
    ],
    seasonal: [
      ...serverEvents.map((e) => ({ icon: e.reward?.icon || '🎯', title: e.title, text: `${e.start} → ${e.end}`, status: e.status })),
      ...WINDOWS.map((w) => ({ icon: '💶', title: `${w.label[0].toUpperCase()}${w.label.slice(1)}`, text: `Semaines ${w.from} à ${w.to} de votre saison`, status: windowOf(s.week) === w ? 'en-cours' : '' })),
    ],
    matches: realNext.map((f) => ({ ...f, club: data.clubs.clubs.find((x) => x.id === f.opponent) })),
  };
}

export { levelFor };
