// Collection de cartes, carte du jour, quiz hebdomadaire, archives à débloquer, missions locales.
import { createRng, hashSeed } from './rng.js';
import { applyEvent, ensureCommunity, queueAction, isoDay } from './community.js';
import { addReputation } from './activities.js';

export const RARITY = {
  commune: { label: 'Classique', weight: 6, dupXp: 5 },
  rare: { label: 'Rare', weight: 3, dupXp: 10 },
  legendaire: { label: 'Légendaire', weight: 1, dupXp: 25 },
};

/** Toutes les cartes à collectionner, construites depuis les contenus (pas de photos : icônes et textes). */
export function allCards(data) {
  const h = data.heritage;
  const m = data.museum;
  const cards = [];
  for (const f of h.figures) cards.push({ id: `fig-${slug(f.name)}`, type: 'Légende', icon: f.icon, title: f.name, sub: f.role, text: f.text, rarity: /Roux|Deschamps|Cantona/.test(f.name) ? 'legendaire' : 'rare' });
  for (const mo of h.moments) cards.push({ id: `mom-${mo.year}`, type: 'Moment', icon: '🕰️', title: `${mo.year} · ${mo.title}`, sub: 'Moment marquant', text: mo.text, rarity: [1996, 2022].includes(mo.year) ? 'legendaire' : 'commune' });
  for (const e of h.eras) cards.push({ id: `era-${e.id}`, type: 'Époque', icon: e.reward.icon, title: e.title, sub: e.years, text: e.text.slice(0, 140) + '…', rarity: 'rare' });
  for (const t of m.trophies) cards.push({ id: `tro-${t.id}`, type: 'Trophée', icon: t.icon, title: `${t.title} ${t.years}`, sub: 'Palmarès', text: t.text, rarity: t.id === 'd1-1996' ? 'legendaire' : 'rare' });
  for (const mt of m.matches) cards.push({ id: `match-${mt.id}`, type: 'Match', icon: '🏟️', title: `${mt.year} · ${mt.title}`, sub: mt.score, text: mt.text, rarity: 'commune' });
  for (const c of data.cities.cities) cards.push({ id: `com-${c.id}`, type: 'Commune', icon: '📍', title: c.name, sub: data.territory.communes[c.id].tagline, text: data.territory.communes[c.id].intro.slice(0, 140) + '…', rarity: 'commune' });
  return cards;
}
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function ensure(save) {
  save.collection ||= { cards: [], archives: [] };
  save.collection.counts ||= {};
  save.collection.weekly ||= {};
  save.collection.lastPack ??= null;
  save.collection.localMissions ||= {};
  ensureCommunity(save);
}

/** Ajoute une carte précise (brouillon). Renvoie { card, duplicate, xp }. */
export function grantCard(draft, data, cardId) {
  ensure(draft);
  const card = allCards(data).find((c) => c.id === cardId);
  if (!card) return null;
  const c = draft.collection;
  c.counts[cardId] = (c.counts[cardId] || 0) + 1;
  if (c.cards.includes(cardId)) {
    const xp = RARITY[card.rarity].dupXp;
    draft.community.xp += xp;
    return { card, duplicate: true, xp };
  }
  c.cards.push(cardId);
  return { card, duplicate: false, xp: 0 };
}

/** Tire une carte aléatoire (pondérée par la rareté), en favorisant les cartes manquantes. */
export function drawCard(draft, data, rng) {
  const cards = allCards(data);
  const owned = new Set(draft.collection?.cards || []);
  const card = rng.weighted(cards, (c) => RARITY[c.rarity].weight * (owned.has(c.id) ? 0.4 : 1));
  return grantCard(draft, data, card.id);
}

/** Carte du jour : une par jour de visite. */
export function openDailyPack(save, data, today = isoDay()) {
  if (save.collection?.lastPack === today) return { save, result: null };
  const draft = structuredClone(save);
  ensure(draft);
  draft.collection.lastPack = today;
  const result = drawCard(draft, data, createRng(hashSeed(draft.seed, 'pack', today)));
  return { save: draft, result };
}

// --- Quiz hebdomadaire ---------------------------------------------------------------
export const WEEKLY_SIZE = 5;
export function isoWeekKey(today) {
  const d = new Date(today + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}
/** Les 5 questions de la semaine (identiques pour tous les supporters : même clé de semaine). */
export function weeklyQuiz(data, today = isoDay()) {
  const key = isoWeekKey(today);
  const rng = createRng(hashSeed('quiz', key));
  const qids = rng.shuffle(data.heritage.weeklyPool).slice(0, WEEKLY_SIZE);
  return { key, qids };
}

export function answerWeekly(save, data, today, qid, choice) {
  const { key, qids } = weeklyQuiz(data, today);
  if (!qids.includes(qid)) return { save, error: 'Question hors quiz de la semaine.' };
  const draft = structuredClone(save);
  ensure(draft);
  const w = (draft.collection.weekly[key] ||= { answers: {}, rewarded: false });
  if (qid in w.answers) return { save, error: 'Déjà répondu.' };
  const correct = choice === data.heritage.questions[qid].answer;
  w.answers[qid] = correct;
  const c = draft.community;
  c.stats.quizAnswered++;
  if (correct) { c.stats.quizCorrect++; c.xp += 25; c.weekly.xp += 25; }
  c.weekly.heritage++;
  queueAction(draft, 'weekQuiz', { qid, answer: choice });
  let reward = null;
  if (Object.keys(w.answers).length === qids.length && !w.rewarded) {
    w.rewarded = true;
    const score = Object.values(w.answers).filter(Boolean).length;
    const rng = createRng(hashSeed(draft.seed, 'weekly', key));
    reward = { score, cards: [] };
    const n = score >= 5 ? 2 : score >= 3 ? 1 : 0;
    for (let i = 0; i < n; i++) reward.cards.push(drawCard(draft, data, rng));
  }
  return { save: draft, correct, reward };
}
export const weeklyDone = (save) => Object.values(save.collection?.weekly || {}).filter((w) => w.rewarded).length;

// --- Archives -----------------------------------------------------------------------
export function archiveUnlocked(save, data, a) {
  const u = a.unlock;
  if (u.type === 'era') return (save.community?.heritage?.items || []).includes(u.id);
  if (u.type === 'cards') return (save.collection?.cards?.length || 0) >= u.n;
  if (u.type === 'weekly') return weeklyDone(save) >= u.n;
  return false;
}
export function unlockHint(a) {
  const u = a.unlock;
  if (u.type === 'era') return 'Complétez la mission historique de l’époque correspondante.';
  if (u.type === 'cards') return `Collectionnez ${u.n} cartes.`;
  if (u.type === 'weekly') return `Terminez ${u.n} quiz de la semaine.`;
  return '';
}

// --- Missions locales (football amateur, territoire, histoire) ----------------------
/** Mission locale de la semaine dans une commune (après la mission principale). */
export function localMissionOf(save, data, cityId) {
  const list = data.museum.localMissions;
  const rng = createRng(hashSeed(save.seed, save.season, save.week, 'local', cityId));
  const m = rng.pick(list);
  const city = data.cities.cities.find((c) => c.id === cityId);
  return { ...m, title: m.title.replace('{city}', city.name), text: m.text.replace('{city}', city.name), key: `${save.season}:${save.week}:${cityId}` };
}

export function doLocalMission(save0, data, cityId) {
  if (!save0.community?.missionsDone?.[cityId]) return { save: save0, result: { error: 'Accomplissez d’abord la mission principale de la commune.' } };
  if (save0.travelPointsLeft < 1) return { save: save0, result: { error: 'Plus de points de déplacement cette semaine.' } };
  const m = localMissionOf(save0, data, cityId);
  if (save0.collection?.localMissions?.[m.key]) return { save: save0, result: { error: 'Mission locale déjà réalisée cette semaine.' } };
  const save = structuredClone(save0);
  ensure(save);
  save.travelPointsLeft--;
  save.collection.localMissions[m.key] = true;
  addReputation(save, cityId, 6);
  const xp = applyEvent(save, 'activity', { cityId, activity: `locale-${m.id}` }) + 10;
  save.community.xp += 10;
  const rng = createRng(hashSeed(save.seed, m.key));
  const card = rng.chance(0.5) ? drawCard(save, data, rng) : null;
  save.log.push({ week: save.week, text: `Mission locale à ${data.cities.cities.find((c) => c.id === cityId).name} : ${m.title}.` });
  return { save, result: { title: m.title, text: m.text, xp, card } };
}

/** Cartes gagnées en complétant une époque (époque + moments de la période). */
export function grantEraCards(save0, data, eraId) {
  const save = structuredClone(save0);
  const era = data.heritage.eras.find((e) => e.id === eraId);
  const [from, to] = era.years.match(/\d{4}/g)?.map(Number) ?? [0, 0];
  const got = [grantCard(save, data, `era-${eraId}`)];
  for (const mo of data.heritage.moments) if (mo.year >= from && mo.year <= (to || 9999)) got.push(grantCard(save, data, `mom-${mo.year}`));
  return { save, cards: got.filter(Boolean) };
}

/** Quiz d'un match historique du musée : bonne réponse = carte du match. */
export function answerMatchQuiz(save0, data, matchId, choice) {
  const mt = data.museum.matches.find((x) => x.id === matchId);
  const q = data.heritage.questions[mt.quiz];
  const save = structuredClone(save0);
  ensure(save);
  const correct = choice === q.answer;
  const before = save.community.heritage.answered[mt.quiz];
  if (before !== true) {
    save.community.heritage.answered[mt.quiz] = correct;
    save.community.stats.quizAnswered++;
    save.community.weekly.heritage++;
    if (before === undefined) queueAction(save, 'quiz', { qid: mt.quiz, answer: choice });
    if (correct) { save.community.stats.quizCorrect++; save.community.xp += 20; }
  }
  const card = correct ? grantCard(save, data, `match-${matchId}`) : null;
  return { save, correct, card };
}
