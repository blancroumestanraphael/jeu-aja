// Espace supporter : profil, ancienneté, XP, niveaux (avec effets en jeu), défis hebdo, défis collectifs, succès.
// API publique pure (save → nouveau save). `applyEvent` agit sur un brouillon déjà cloné par le moteur.
// Rien n'est envoyé à un serveur : la version connectée (classements entre supporters) viendra plus tard.

export const XP = {
  activity: 15, mission: 40, missionFail: 10, recruit: 30, promotion: 20, alumniEstablished: 60,
  keyMatch: 25, week: 5, heritageRead: 10, quizFirst: 20, quizRetry: 5, daily: 15, dailyWrong: 5,
  dayVisit: 10, landmark: 15, partner: 40, discover: 5,
};

// --- Niveaux et effets en jeu -------------------------------------------------
export const levelFor = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const xpForLevel = (level) => (level - 1) ** 2 * 100;

export const PERKS = [
  { level: 2, id: 'tribune', icon: '📣', title: 'Tribune animée', text: 'Recettes de billetterie +20 % à domicile.' },
  { level: 3, id: 'ambassadeur', icon: '🤝', title: 'Ambassadeur', text: '+5 % de réussite auprès des familles.' },
  { level: 4, id: 'carnet', icon: '🚗', title: 'Carnet d’adresses', text: '3 points de déplacement par semaine au lieu de 2.' },
  { level: 5, id: 'douzieme', icon: '🔊', title: 'Douzième homme', text: '+5 de moral pour l’équipe 1 à l’Abbé-Deschamps.' },
  { level: 6, id: 'mecene', icon: '💙', title: 'Club des supporters', text: '+500 € par semaine pour le centre de formation.' },
];

export function hasPerk(save, id) {
  const perk = PERKS.find((p) => p.id === id);
  return !!perk && levelFor(save.community?.xp || 0) >= perk.level;
}

export const GENERATIONS = [
  { id: 'roux', label: 'Génération Guy Roux', from: 0, to: 1999 },
  { id: 'coupes', label: 'Génération des Coupes', from: 2000, to: 2011 },
  { id: 'resistance', label: 'Génération Résistance', from: 2012, to: 2021 },
  { id: 'retour', label: 'Génération du Retour', from: 2022, to: 9999 },
];
export const generationOf = (year) => (year ? GENERATIONS.find((g) => year >= g.from && year <= g.to) : null);

// --- État ---------------------------------------------------------------------
const weekKey = (save) => `${save.season}:${save.week}`;
const emptyWeekly = (save) => ({ key: weekKey(save), activities: 0, newCity: false, recruits: 0, heritage: 0, xp: 0 });

export function ensureCommunity(draft) {
  if (!draft) return draft;
  const c = (draft.community ||= {});
  c.displayName ||= 'Supporter AJA';
  c.homeCity ??= null;
  c.supporterSince ??= null;
  c.xp = Number.isFinite(c.xp) ? c.xp : 0;
  c.firstSeen ??= null;
  c.activeDays = Array.isArray(c.activeDays) ? c.activeDays : [];
  c.stats = {
    activities: 0, missions: 0, recruits: 0, promotions: 0, alumniEstablished: 0, quizCorrect: 0, quizAnswered: 0,
    keyMatches: 0, weeksPlayed: 0, partnerMissions: 0, landmarks: 0, ...(c.stats || {}),
  };
  c.visitedCities = Array.isArray(c.visitedCities) ? c.visitedCities : [];
  c.discoveredCities = Array.isArray(c.discoveredCities) ? c.discoveredCities : [];
  c.missionsDone ||= {};
  c.heritage = { erasRead: [], answered: {}, items: [], ...(c.heritage || {}) };
  c.landmarksVisited ||= [];
  c.partnersMet ||= [];
  c.claimedChallenges = Array.isArray(c.claimedChallenges) ? c.claimedChallenges : [];
  c.daily ||= { date: null, answered: false };
  c.seasonStats ||= {};
  c.seasonStats[draft.season] ||= { recruits: 0, recruitsYonne: 0, alumni: 0 };
  // Défis hebdomadaires : clé saison + semaine (corrige le blocage d'une saison à l'autre)
  if (!c.weekly || c.weekly.key !== weekKey(draft)) c.weekly = emptyWeekly(draft);
  delete c.collectivePoints; // ancien compteur, doublon de l'XP
  return draft;
}

function addXp(c, n) {
  c.xp += n;
  c.weekly.xp += n;
  return n;
}

// --- File d'actions vers le serveur communautaire ------------------------------
// Le client n'envoie pas de points : il envoie des actions que le serveur vérifie (voir server/core.js).
export const MAX_PENDING = 500;
export function queueAction(draft, type, payload = {}) {
  draft.sync ||= { pending: [], lastSync: null };
  draft.sync.seq = (draft.sync.seq || 0) + 1;
  draft.sync.pending.push({ type, payload, clientId: `${draft.seed}-${draft.season}-${draft.sync.seq}`, at: new Date().toISOString() });
  if (draft.sync.pending.length > MAX_PENDING) draft.sync.pending = draft.sync.pending.slice(-MAX_PENDING);
}
const SERVER_ACTION = { activity: 'activity', recruit: 'recruit', keyMatch: 'keyMatch', alumniEstablished: 'alumni' };

/** Enregistre une action sur un brouillon (déjà cloné). Renvoie l'XP gagnée. */
export function applyEvent(draft, type, payload = {}, yonneCityIds = null) {
  ensureCommunity(draft);
  const c = draft.community;
  if (SERVER_ACTION[type]) queueAction(draft, SERVER_ACTION[type], payload.cityId ? { cityId: payload.cityId } : {});
  if (type === 'mission') queueAction(draft, 'mission', { cityId: payload.cityId, answer: payload.answer });
  const markVisit = (cityId) => {
    if (cityId && !c.visitedCities.includes(cityId)) {
      c.visitedCities.push(cityId);
      c.weekly.newCity = true;
    }
  };
  switch (type) {
    case 'activity':
      c.stats.activities++;
      c.weekly.activities++;
      markVisit(payload.cityId);
      return addXp(c, XP.activity);
    case 'mission':
      c.weekly.activities++;
      markVisit(payload.cityId);
      if (!payload.success) return addXp(c, XP.missionFail);
      c.stats.missions++;
      c.missionsDone[payload.cityId] = { season: draft.season, week: draft.week };
      return addXp(c, XP.mission);
    case 'recruit': {
      c.stats.recruits++;
      c.weekly.recruits++;
      const ss = c.seasonStats[draft.season];
      ss.recruits++;
      if (!yonneCityIds || yonneCityIds.includes(payload.cityId)) ss.recruitsYonne++;
      return addXp(c, XP.recruit);
    }
    case 'promotion':
      c.stats.promotions++;
      return addXp(c, XP.promotion);
    case 'alumniEstablished':
      c.stats.alumniEstablished++;
      c.seasonStats[draft.season].alumni++;
      return addXp(c, XP.alumniEstablished);
    case 'keyMatch':
      c.stats.keyMatches++;
      return addXp(c, XP.keyMatch);
    case 'week':
      c.stats.weeksPlayed++;
      return addXp(c, XP.week);
    case 'heritageView':
      c.weekly.heritage++;
      return 0;
    case 'heritageRead':
      c.weekly.heritage++;
      if (c.heritage.erasRead.includes(payload.eraId)) return 0;
      c.heritage.erasRead.push(payload.eraId);
      return addXp(c, XP.heritageRead);
    case 'landmark':
      if (c.landmarksVisited.includes(payload.id)) return 0;
      c.landmarksVisited.push(payload.id);
      c.stats.landmarks++;
      return addXp(c, XP.landmark);
    case 'partner':
      if (c.partnersMet.includes(payload.sponsorId)) return 0;
      c.partnersMet.push(payload.sponsorId);
      c.stats.partnerMissions++;
      return addXp(c, payload.xp ?? XP.partner);
    case 'discover':
      if (c.discoveredCities.includes(payload.cityId)) return 0;
      c.discoveredCities.push(payload.cityId);
      return addXp(c, XP.discover);
    default:
      return 0;
  }
}

/** Version pure d'applyEvent. */
export function recordEvent(save, type, payload, yonneCityIds) {
  const draft = structuredClone(save);
  applyEvent(draft, type, payload, yonneCityIds);
  return draft;
}

// --- Ancienneté et visites quotidiennes ---------------------------------------
export const isoDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function touchDay(save, today) {
  const draft = structuredClone(save);
  ensureCommunity(draft);
  const c = draft.community;
  c.firstSeen ||= today;
  if (!c.activeDays.includes(today)) {
    queueAction(draft, 'visit', { date: today });
    c.activeDays.push(today);
    c.activeDays = c.activeDays.slice(-400);
    addXp(c, XP.dayVisit);
  }
  return draft;
}

export function currentStreak(activeDays, today) {
  const set = new Set(activeDays);
  let n = 0;
  const d = new Date(today + 'T12:00:00');
  while (set.has(isoDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function seniorityDays(firstSeen, today) {
  if (!firstSeen) return 0;
  return Math.round((new Date(today + 'T12:00:00') - new Date(firstSeen + 'T12:00:00')) / 86400000) + 1;
}

// --- Patrimoine : question du jour et missions historiques --------------------
export function dailyQuestionId(heritage, today) {
  const pool = heritage.dailyPool;
  const n = Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000);
  return pool[n % pool.length];
}

export function answerDaily(save, heritage, today, choice) {
  const draft = structuredClone(save);
  ensureCommunity(draft);
  const c = draft.community;
  if (c.daily.date === today && c.daily.answered) return { save, correct: null };
  const q = heritage.questions[dailyQuestionId(heritage, today)];
  const correct = choice === q.answer;
  c.daily = { date: today, answered: true, correct };
  queueAction(draft, 'daily', { date: today, answer: choice });
  c.stats.quizAnswered++;
  if (correct) c.stats.quizCorrect++;
  c.weekly.heritage++;
  addXp(c, correct ? XP.daily : XP.dailyWrong);
  return { save: draft, correct };
}

export function eraComplete(save, era) {
  const a = save.community?.heritage?.answered || {};
  return era.quiz.every((qid) => a[qid] === true);
}

/** Réponse à une question d'une mission historique (une ère = 3 questions). */
export function answerHeritage(save, heritage, eraId, qid, choice) {
  const draft = structuredClone(save);
  ensureCommunity(draft);
  const c = draft.community;
  const era = heritage.eras.find((e) => e.id === eraId);
  const q = heritage.questions[qid];
  const correct = choice === q.answer;
  const before = c.heritage.answered[qid];
  if (before === true) return { save, correct, already: true };
  c.heritage.answered[qid] = correct;
  if (before === undefined) queueAction(draft, 'quiz', { qid, answer: choice });
  c.stats.quizAnswered++;
  c.weekly.heritage++;
  let unlocked = null;
  if (correct) {
    c.stats.quizCorrect++;
    addXp(c, before === undefined ? XP.quizFirst : XP.quizRetry);
    if (eraComplete(draft, era) && !c.heritage.items.includes(era.id)) {
      c.heritage.items.push(era.id);
      // Récompense en jeu : un mécène du territoire soutient le centre
      draft.budget += 1500;
      for (const city of Object.values(draft.cities)) city.reputation = Math.min(100, city.reputation + 2);
      draft.log.push({ week: draft.week, text: `Patrimoine : « ${era.title} » complété. Objet débloqué : ${era.reward.item}.` });
      unlocked = era.reward;
    }
  }
  return { save: draft, correct, unlocked };
}

// --- Défis hebdomadaires (personnels) -----------------------------------------
export const WEEKLY_CHALLENGES = [
  { id: 'territoire', icon: '📍', title: 'Sur le terrain', text: 'Réaliser une mission ou une activité dans une commune de l’Yonne.', xp: 30, progress: (w) => [Math.min(w.activities, 1), 1] },
  { id: 'decouverte', icon: '🧭', title: 'À la découverte de l’Yonne', text: 'Agir dans une commune où vous n’étiez jamais allé.', xp: 25, progress: (w) => [w.newCity ? 1 : 0, 1] },
  { id: 'formation', icon: '🌱', title: 'La relève ajaïste', text: 'Convaincre une famille de rejoindre le centre.', xp: 40, progress: (w) => [Math.min(w.recruits, 1), 1] },
  { id: 'patrimoine', icon: '📜', title: 'Transmettre la mémoire', text: 'Explorer le patrimoine : question du jour, mission historique ou livre d’or.', xp: 20, progress: (w) => [Math.min(w.heritage, 1), 1] },
];

export const challengeKey = (save, id) => `${save.season}:${save.week}:${id}`;

export function claimChallenge(save, id) {
  const ch = WEEKLY_CHALLENGES.find((x) => x.id === id);
  const draft = structuredClone(save);
  ensureCommunity(draft);
  const c = draft.community;
  const [v, t] = ch.progress(c.weekly);
  const key = challengeKey(draft, id);
  if (v < t || c.claimedChallenges.includes(key)) return { save, ok: false };
  c.claimedChallenges.push(key);
  c.claimedChallenges = c.claimedChallenges.slice(-200);
  addXp(c, ch.xp);
  return { save: draft, ok: true };
}

// --- Défis collectifs (prototype : progression de cette partie) ---------------
export const MOBILISATION_XP = 120;

export function collectiveChallenges(save, data) {
  const c = save.community;
  const ss = c.seasonStats[save.season] || { recruitsYonne: 0, alumni: 0 };
  const fixture = data.fixtures.fixtures.find((f) => f.week === save.week);
  const nextKey = data.fixtures.fixtures.find((f) => f.week >= save.week && f.isKeyMatch);
  const opp = (f) => data.clubs.clubs.find((x) => x.id === f.opponent)?.name;
  const correct = Object.values(c.heritage.answered).filter((x) => x === true).length;
  return [
    {
      id: 'mobilisation', icon: '📣', title: 'Mobilisation avant le grand match',
      text: fixture?.isKeyMatch
        ? `Cette semaine, l’AJA affronte ${opp(fixture)}. Gagnez ${MOBILISATION_XP} XP avant le match : l’équipe jouera avec +5 de moral.`
        : nextKey ? `Prochain grand match : ${opp(nextKey)} (J${nextKey.week}). La mobilisation s’ouvrira cette semaine-là.` : 'Plus de grand match cette saison.',
      value: fixture?.isKeyMatch ? c.weekly.xp : 0, target: MOBILISATION_XP, active: !!fixture?.isKeyMatch,
      reward: '+5 de moral pour le grand match',
    },
    { id: 'generation-yonne', icon: '🌱', title: 'Génération Yonne', text: 'Faire venir au centre 5 jeunes de l’Yonne cette saison.', value: ss.recruitsYonne, target: 5, reward: 'Badge « Génération Yonne »' },
    { id: 'yonne-unie', icon: '🗺️', title: 'Toute l’Yonne derrière l’AJA', text: 'Accomplir la mission des 8 communes.', value: Object.keys(c.missionsDone).length, target: 8, reward: 'Badge « Ambassadeur de l’Yonne »' },
    { id: 'releve', icon: '⭐', title: 'La relève', text: 'Installer 3 jeunes formés en équipe 1 (au moins 270 minutes jouées chacun).', value: c.stats.alumniEstablished, target: 3, reward: 'Badge « Passeur de formation »' },
    { id: 'memoire', icon: '📜', title: 'Mémoire vive', text: 'Répondre juste à 15 questions sur l’histoire du club.', value: correct, target: 15, reward: 'Badge « Historien de l’AJA »' },
  ];
}

export const mobilisationActive = (save, data) => {
  const f = data.fixtures.fixtures.find((x) => x.week === save.week);
  return !!(f?.isKeyMatch && (save.community?.weekly?.xp || 0) >= MOBILISATION_XP);
};

// --- Succès ---------------------------------------------------------------------
export function achievements(save, data, today) {
  const c = save.community;
  const missions = Object.keys(c.missionsDone).length;
  const erasDone = data.heritage.eras.filter((e) => eraComplete(save, e)).length;
  return [
    { id: 'explorateur', icon: '🧭', title: 'Explorateur', text: 'Mission accomplie dans 3 communes', ok: missions >= 3 },
    { id: 'ambassadeur', icon: '🗺️', title: 'Ambassadeur de l’Yonne', text: 'Mission accomplie dans les 8 communes', ok: missions >= 8 },
    { id: 'generation-yonne', icon: '🌱', title: 'Génération Yonne', text: '5 jeunes de l’Yonne recrutés en une saison', ok: Object.values(c.seasonStats).some((s) => s.recruitsYonne >= 5) },
    { id: 'passeur', icon: '⭐', title: 'Passeur de formation', text: 'Un jeune formé installé en équipe 1 (270 min)', ok: c.stats.alumniEstablished >= 1 },
    { id: 'historien', icon: '📜', title: 'Historien', text: 'Une époque de l’AJA complétée', ok: erasDone >= 1 },
    { id: 'memoire', icon: '🏛️', title: 'Mémoire de l’AJA', text: 'Les 5 époques complétées', ok: erasDone >= data.heritage.eras.length },
    { id: 'fidele', icon: '🔥', title: 'Fidèle', text: '3 jours de suite dans le jeu', ok: currentStreak(c.activeDays, today) >= 3 },
    { id: 'abonne', icon: '🎫', title: 'Abonné', text: '10 jours de visite au total', ok: c.activeDays.length >= 10 },
    { id: 'veille', icon: '🌙', title: 'Veilleur', text: '3 Matchs de la veille joués', ok: c.stats.keyMatches >= 3 },
    { id: 'partenaire', icon: '🤝', title: 'Ami des partenaires', text: '3 partenaires locaux découverts', ok: c.stats.partnerMissions >= 3 },
  ];
}
