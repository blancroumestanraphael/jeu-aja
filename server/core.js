// Cœur du serveur communautaire : comptes, actions validées côté serveur, classements, défis, groupes,
// profils publics, administration. Indépendant du transport (HTTP de dev, fonction Netlify) et du stockage.
//
// Principe anti-triche : le client n'envoie jamais de points. Il envoie des ACTIONS (mission + réponse,
// question + réponse, résultat de match…). Le serveur vérifie, plafonne, déduplique et calcule les points.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { levelFor, dailyQuestionId, GENERATIONS } from '../src/engine/community.js';

// --- Règles ---------------------------------------------------------------------
export const RULES = {
  visit: { points: 10, perDay: 1 },
  mission: { points: 40, perDay: 8 },
  activity: { points: 15, perDay: 12 },
  recruit: { points: 30, perDay: 6 },
  quiz: { points: 20, perDay: 30 },
  daily: { points: 15, perDay: 1 },
  weekQuiz: { points: 25, perDay: 10 },
  match: { points: 0, perDay: 20 }, // victoire 10, nul 4
  keyMatch: { points: 25, perDay: 2 },
  alumni: { points: 60, perDay: 2 },
};
export const MAX_ACTIONS_PER_DAY = 150;
export const MAX_GROUP_SIZE = 50;
const AVATARS = ['⚽', '🦁', '🔵', '⭐', '🏟️', '🧢', '🌱', '🧣', '🏆', '💙'];
const DEPARTEMENTS = /^(0[1-9]|[1-8]\d|9[0-5]|2A|2B|97[1-6]|99)$/; // 99 = étranger

const dayOf = (now) => now.toISOString().slice(0, 10);

// --- Jetons d'authentification (prototype) -------------------------------------
// Production : remplacer par la vérification d'un jeton Firebase Auth (voir docs/architecture.md).
export function signToken(secret, userId) {
  return `${userId}.${createHmac('sha256', secret).update(userId).digest('base64url')}`;
}
export function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const userId = token.slice(0, token.lastIndexOf('.'));
  const expected = Buffer.from(signToken(secret, userId));
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got) ? userId : null;
}

// --- Validation des profils -------------------------------------------------------
const BANNED = ['merde', 'connard', 'pute', 'enculé', 'nazi', 'salope', 'fdp'];
export function cleanText(s, max) {
  const t = String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return BANNED.some((w) => t.toLowerCase().includes(w)) ? null : t;
}

function validateProfile(input, content) {
  const out = {};
  if (input.displayName !== undefined) {
    const n = cleanText(input.displayName, 24);
    if (!n || n.length < 3) throw httpError(400, 'Nom de supporter : 3 à 24 caractères, sans grossièreté.');
    out.displayName = n;
  }
  if (input.commune !== undefined) {
    if (input.commune && !content.communeIds.includes(input.commune) && input.commune !== 'auxerre') throw httpError(400, 'Commune inconnue.');
    out.commune = input.commune || null;
  }
  if (input.departement !== undefined) {
    const d = String(input.departement || '').toUpperCase();
    if (!DEPARTEMENTS.test(d)) throw httpError(400, 'Département invalide (ex. 89).');
    out.departement = d;
  }
  if (input.supporterSince !== undefined) {
    const y = Number(input.supporterSince);
    out.supporterSince = y >= 1905 && y <= 2100 ? y : null;
  }
  if (input.bio !== undefined) {
    const b = cleanText(input.bio, 140);
    if (b === null) throw httpError(400, 'Présentation refusée.');
    out.bio = b;
  }
  if (input.avatar !== undefined) out.avatar = AVATARS.includes(input.avatar) ? input.avatar : AVATARS[0];
  if (input.favoritePlayer !== undefined) out.favoritePlayer = cleanText(input.favoritePlayer, 40) || null;
  return out;
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// --- Contenu (données du jeu nécessaires à la vérification) ------------------------
export function buildContent({ territory, heritage, cities, events }) {
  return {
    territory, heritage, events,
    communeIds: cities.cities.map((c) => c.id),
    communeNames: Object.fromEntries([...cities.cities.map((c) => [c.id, c.name]), ['auxerre', 'Auxerre']]),
  };
}

// --- Service -------------------------------------------------------------------------
/**
 * storage : { get(key), set(key, value), list(prefix) → [keys] } (asynchrone)
 * opts : { secret, adminToken, content, now() }
 */
export function createService(storage, { secret, adminToken, content, now = () => new Date() }) {
  if (!secret) throw new Error('AJA_SECRET manquant');

  const userKey = (id) => `users/${id}`;
  const getUser = (id) => storage.get(userKey(id));
  const allUsers = async () => (await Promise.all((await storage.list('users/')).map((k) => storage.get(k)))).filter(Boolean);
  const getEvents = async () => (await storage.get('content/events')) || content.events.events;

  function auth(headers) {
    const h = headers.authorization || headers.Authorization || '';
    const id = verifyToken(secret, h.replace(/^Bearer\s+/i, ''));
    if (!id) throw httpError(401, 'Non authentifié.');
    return id;
  }
  function adminAuth(headers) {
    const h = (headers.authorization || headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || h !== adminToken) throw httpError(403, 'Accès administrateur refusé.');
  }

  function publicProfile(u, groups = {}) {
    const today = dayOf(now());
    const seniority = Math.round((new Date(today) - new Date(u.firstSeen)) / 86400000) + 1;
    const gen = GENERATIONS.find((g) => u.supporterSince && u.supporterSince >= g.from && u.supporterSince <= g.to);
    return {
      id: u.id, displayName: u.displayName, avatar: u.avatar, bio: u.bio, favoritePlayer: u.favoritePlayer,
      commune: u.commune, communeName: content.communeNames[u.commune] || null, departement: u.departement,
      supporterSince: u.supporterSince, generation: gen?.label || null,
      points: u.points, level: levelFor(u.points), firstSeen: u.firstSeen, seniorityDays: seniority, activeDays: u.activeDays.length,
      stats: u.stats, trophies: trophiesOf(u), group: u.groupId ? { id: u.groupId, name: groups[u.groupId]?.name || null } : null,
    };
  }

  function trophiesOf(u) {
    const t = [];
    if (u.stats.missions >= 3) t.push({ id: 'explorateur', icon: '🧭', title: 'Explorateur de l’Yonne' });
    if (u.stats.missions >= 8) t.push({ id: 'ambassadeur', icon: '🗺️', title: 'Ambassadeur de l’Yonne' });
    if (u.stats.quizCorrect >= 10) t.push({ id: 'historien', icon: '📜', title: 'Historien' });
    if (u.stats.alumni >= 1) t.push({ id: 'formateur', icon: '🌱', title: 'Formateur' });
    if (u.activeDays.length >= 7) t.push({ id: 'fidele', icon: '🔥', title: 'Fidèle (7 jours)' });
    if (u.activeDays.length >= 30) t.push({ id: 'abonne', icon: '🎫', title: 'Abonné (30 jours)' });
    if (u.pioneer) t.push({ id: 'pionnier', icon: '🚀', title: 'Pionnier de Génération AJA' });
    for (const r of u.eventRewards || []) t.push({ id: `ev-${r.id}`, icon: r.icon, title: r.badge });
    return t;
  }

  // Vérifie une action et renvoie les points (ou une raison de refus).
  function score(u, a, today) {
    const p = a.payload || {};
    switch (a.type) {
      case 'visit':
        if (p.date !== today) return { reject: 'date' };
        return { points: RULES.visit.points };
      case 'mission': {
        const m = content.territory.communes[p.cityId]?.mission;
        if (!m) return { reject: 'commune' };
        if (u.missions.includes(p.cityId)) return { reject: 'deja' };
        if (Number(p.answer) !== m.answer) return { points: 0, metric: null };
        u.missions.push(p.cityId);
        u.stats.missions++;
        return { points: RULES.mission.points, metric: 'missions' };
      }
      case 'activity':
        if (!content.communeIds.includes(p.cityId)) return { reject: 'commune' };
        return { points: RULES.activity.points };
      case 'recruit':
        u.stats.recruits++;
        return { points: RULES.recruit.points, metric: 'recruits' };
      case 'quiz':
      case 'weekQuiz': {
        const q = content.heritage.questions[p.qid];
        if (!q) return { reject: 'question' };
        const key = `${a.type}:${p.qid}`;
        if (u.answered.includes(key)) return { reject: 'deja' };
        u.answered.push(key);
        if (Number(p.answer) !== q.answer) return { points: 0 };
        u.stats.quizCorrect++;
        return { points: RULES[a.type].points, metric: 'quiz' };
      }
      case 'daily': {
        if (p.date !== today) return { reject: 'date' };
        const qid = dailyQuestionId(content.heritage, today);
        const q = content.heritage.questions[qid];
        if (Number(p.answer) !== q.answer) return { points: 0 };
        u.stats.quizCorrect++;
        return { points: RULES.daily.points, metric: 'quiz' };
      }
      case 'match': {
        const gf = Number(p.goalsFor), ga = Number(p.goalsAgainst);
        if (!(gf >= 0 && gf <= 10 && ga >= 0 && ga <= 10)) return { reject: 'score' };
        const key = `${p.seed}:${p.season}:${p.week}`;
        if (u.matches.includes(key)) return { reject: 'deja' };
        u.matches.push(key);
        u.matches = u.matches.slice(-400);
        u.stats.matches++;
        u.stats.goals += gf;
        if (gf > ga) u.stats.wins++;
        return { points: gf > ga ? 10 : gf === ga ? 4 : 0, goals: gf, win: gf > ga };
      }
      case 'keyMatch':
        u.stats.keyMatches++;
        return { points: RULES.keyMatch.points };
      case 'alumni':
        u.stats.alumni++;
        return { points: RULES.alumni.points };
      default:
        return { reject: 'type' };
    }
  }

  async function bumpEvents(u, results, today) {
    const events = await getEvents();
    for (const ev of events) {
      if (today < ev.start || today > ev.end) continue;
      if (ev.scope === 'yonne' && u.departement !== '89') continue;
      let inc = 0;
      for (const r of results) {
        if (ev.metric === 'actions') inc += 1;
        else if (ev.metric === 'goals') inc += r.goals || 0;
        else if (ev.metric === 'wins') inc += r.win ? 1 : 0;
        else if (r.metric === ev.metric) inc += 1;
      }
      if (!inc) continue;
      const key = `counters/${ev.id}`;
      const c = (await storage.get(key)) || { total: 0, byCommune: {}, contributors: {}, completedAt: null };
      c.total += inc;
      if (u.commune) c.byCommune[u.commune] = (c.byCommune[u.commune] || 0) + inc;
      c.contributors[u.id] = (c.contributors[u.id] || 0) + inc;
      if (!c.completedAt && c.total >= ev.target) c.completedAt = now().toISOString();
      await storage.set(key, c);
      if (c.completedAt && ev.reward && !(u.eventRewards || []).some((x) => x.id === ev.id)) {
        u.eventRewards = [...(u.eventRewards || []), { id: ev.id, badge: ev.reward.badge, icon: ev.reward.icon }];
      }
    }
  }

  async function logStat(type, n = 1) {
    const day = dayOf(now());
    const key = `stats/${day}`;
    const s = (await storage.get(key)) || { day, actions: {}, activeUsers: [] };
    s.actions[type] = (s.actions[type] || 0) + n;
    await storage.set(key, s);
    return s;
  }

  async function markActive(u) {
    const day = dayOf(now());
    if (!u.activeDays.includes(day)) u.activeDays.push(day);
    u.activeDays = u.activeDays.slice(-400);
    const key = `stats/${day}`;
    const s = (await storage.get(key)) || { day, actions: {}, activeUsers: [] };
    if (!s.activeUsers.includes(u.id)) { s.activeUsers.push(u.id); await storage.set(key, s); }
  }

  const api = {
    async health() {
      return { ok: true, time: now().toISOString(), rules: RULES };
    },

    async register(body) {
      const prof = validateProfile({ departement: '89', ...body }, content);
      if (!prof.displayName) throw httpError(400, 'Nom de supporter requis.');
      const count = (await storage.list('users/')).length;
      const id = `u_${randomBytes(9).toString('base64url')}`;
      const u = {
        id, displayName: prof.displayName, commune: prof.commune ?? null, departement: prof.departement,
        supporterSince: prof.supporterSince ?? null, avatar: AVATARS[0], bio: '', favoritePlayer: null,
        createdAt: now().toISOString(), firstSeen: dayOf(now()), activeDays: [], points: 0,
        stats: { missions: 0, recruits: 0, quizCorrect: 0, matches: 0, wins: 0, goals: 0, alumni: 0, keyMatches: 0, actions: 0 },
        missions: [], answered: [], matches: [], seenIds: [], daily: {}, groupId: null, pioneer: count < 100, eventRewards: [],
      };
      await markActive(u);
      await storage.set(userKey(id), u);
      return { userId: id, token: signToken(secret, id), profile: publicProfile(u) };
    },

    async updateProfile(headers, body) {
      const id = auth(headers);
      const u = await getUser(id);
      if (!u) throw httpError(404, 'Compte introuvable.');
      Object.assign(u, validateProfile(body, content));
      await storage.set(userKey(id), u);
      return { profile: publicProfile(u) };
    },

    /** Réception d'un lot d'actions (file hors ligne du client). */
    async submitActions(headers, body) {
      const id = auth(headers);
      const u = await getUser(id);
      if (!u) throw httpError(404, 'Compte introuvable.');
      const today = dayOf(now());
      const actions = Array.isArray(body?.actions) ? body.actions.slice(0, 100) : [];
      u.daily = u.daily?.day === today ? u.daily : { day: today, total: 0, byType: {} };
      const accepted = [];
      const rejected = [];
      const results = [];
      let gained = 0;
      for (const a of actions) {
        if (!a || typeof a.clientId !== 'string' || !RULES[a.type]) { rejected.push({ clientId: a?.clientId, reason: 'type' }); continue; }
        if (u.seenIds.includes(a.clientId)) { accepted.push(a.clientId); continue; } // déjà reçue : idempotent
        if (u.daily.total >= MAX_ACTIONS_PER_DAY || (u.daily.byType[a.type] || 0) >= RULES[a.type].perDay) {
          rejected.push({ clientId: a.clientId, reason: 'plafond' });
          continue;
        }
        const r = score(u, a, today);
        u.seenIds.push(a.clientId);
        if (r.reject) { rejected.push({ clientId: a.clientId, reason: r.reject }); continue; }
        u.daily.total++;
        u.daily.byType[a.type] = (u.daily.byType[a.type] || 0) + 1;
        u.stats.actions++;
        u.points += r.points;
        gained += r.points;
        accepted.push(a.clientId);
        results.push(r);
        await logStat(a.type);
      }
      u.seenIds = u.seenIds.slice(-600);
      await markActive(u);
      if (results.length) await bumpEvents(u, results, today);
      await storage.set(userKey(id), u);
      return { accepted, rejected, gained, profile: publicProfile(u) };
    },

    async profile(id) {
      const u = await getUser(id);
      if (!u) throw httpError(404, 'Profil introuvable.');
      const groups = u.groupId ? { [u.groupId]: await storage.get(`groups/${u.groupId}`) } : {};
      return { profile: publicProfile(u, groups) };
    },

    async me(headers) {
      return api.profile(auth(headers));
    },

    /** Classements : kind = general | commune | departement | anciennete | accomplissements | groupes */
    async leaderboard(kind = 'general', { meId = null, limit = 50 } = {}) {
      const users = await allUsers();
      const today = dayOf(now());
      const row = (u, value) => ({ id: u.id, name: u.displayName, avatar: u.avatar, commune: content.communeNames[u.commune] || null, value });
      let rows;
      if (kind === 'commune' || kind === 'departement') {
        const field = kind === 'commune' ? 'commune' : 'departement';
        const agg = {};
        for (const u of users) {
          const k = u[field];
          if (!k) continue;
          agg[k] ||= { id: k, name: kind === 'commune' ? content.communeNames[k] || k : `Département ${k}`, value: 0, members: 0 };
          agg[k].value += u.points;
          agg[k].members++;
        }
        rows = Object.values(agg);
      } else if (kind === 'generations') {
        const agg = Object.fromEntries(GENERATIONS.map((g) => [g.id, { id: g.id, name: g.label, value: 0, members: 0 }]));
        for (const u of users) {
          const g = GENERATIONS.find((x) => u.supporterSince && u.supporterSince >= x.from && u.supporterSince <= x.to);
          if (g) { agg[g.id].value += u.points; agg[g.id].members++; }
        }
        rows = Object.values(agg).map((r) => ({ ...r, value: r.members ? Math.round(r.value / r.members) : 0 }));
      } else if (kind === 'groupes') {
        const groups = (await Promise.all((await storage.list('groups/')).map((k) => storage.get(k)))).filter(Boolean);
        const byId = Object.fromEntries(users.map((u) => [u.id, u]));
        rows = groups.map((g) => ({ id: g.id, name: g.name, value: g.members.reduce((t, m) => t + (byId[m]?.points || 0), 0), members: g.members.length }));
      } else if (kind === 'anciennete') {
        rows = users.map((u) => row(u, Math.round((new Date(today) - new Date(u.firstSeen)) / 86400000) + 1 + u.activeDays.length / 1000));
      } else if (kind === 'accomplissements') {
        rows = users.map((u) => row(u, trophiesOf(u).length * 100 + u.stats.missions * 3 + u.stats.quizCorrect + u.stats.alumni * 10));
      } else {
        rows = users.map((u) => row(u, u.points));
      }
      rows.sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
      rows.forEach((r, i) => { r.rank = i + 1; });
      const me = meId ? rows.find((r) => r.id === meId) || null : null;
      return { kind, total: rows.length, rows: rows.slice(0, limit), me };
    },

    async events() {
      const today = dayOf(now());
      const events = await getEvents();
      const out = [];
      for (const ev of events) {
        const c = (await storage.get(`counters/${ev.id}`)) || { total: 0, byCommune: {}, contributors: {}, completedAt: null };
        const status = today < ev.start ? 'a-venir' : today > ev.end ? 'termine' : 'en-cours';
        const communes = Object.entries(c.byCommune).map(([id, v]) => ({ id, name: content.communeNames[id] || id, value: v })).sort((a, b) => b.value - a.value);
        out.push({ ...ev, status, progress: c.total, completed: !!c.completedAt, contributors: Object.keys(c.contributors).length, communes });
      }
      return { today, events: out };
    },

    // --- Groupes de supporters
    async createGroup(headers, body) {
      const id = auth(headers);
      const u = await getUser(id);
      const name = cleanText(body?.name, 32);
      if (!name || name.length < 3) throw httpError(400, 'Nom de groupe : 3 à 32 caractères.');
      if (u.groupId) await api.leaveGroup(headers);
      const gid = `g_${randomBytes(4).toString('hex')}`;
      const code = randomBytes(3).toString('hex').toUpperCase();
      const g = { id: gid, name, code, owner: id, members: [id], createdAt: now().toISOString(), description: cleanText(body?.description, 140) || '' };
      await storage.set(`groups/${gid}`, g);
      await storage.set(`groupCodes/${code}`, gid);
      u.groupId = gid;
      await storage.set(userKey(id), u);
      return { group: g };
    },
    async joinGroup(headers, body) {
      const id = auth(headers);
      const gid = await storage.get(`groupCodes/${String(body?.code || '').toUpperCase()}`);
      if (!gid) throw httpError(404, 'Code de groupe inconnu.');
      const g = await storage.get(`groups/${gid}`);
      if (g.members.length >= MAX_GROUP_SIZE) throw httpError(400, 'Groupe complet.');
      const u = await getUser(id);
      if (u.groupId && u.groupId !== gid) await api.leaveGroup(headers);
      if (!g.members.includes(id)) g.members.push(id);
      await storage.set(`groups/${gid}`, g);
      u.groupId = gid;
      await storage.set(userKey(id), u);
      return { group: g };
    },
    async leaveGroup(headers) {
      const id = auth(headers);
      const u = await getUser(id);
      if (!u.groupId) return { ok: true };
      const g = await storage.get(`groups/${u.groupId}`);
      if (g) {
        g.members = g.members.filter((m) => m !== id);
        if (g.owner === id && g.members.length) g.owner = g.members[0];
        await storage.set(`groups/${g.id}`, g);
      }
      u.groupId = null;
      await storage.set(userKey(id), u);
      return { ok: true };
    },
    async group(gid, headers) {
      const g = await storage.get(`groups/${gid}`);
      if (!g) throw httpError(404, 'Groupe introuvable.');
      let isMember = false;
      try { isMember = g.members.includes(auth(headers)); } catch { /* visiteur */ }
      const members = (await Promise.all(g.members.map(getUser))).filter(Boolean)
        .map((u) => ({ id: u.id, name: u.displayName, avatar: u.avatar, points: u.points, level: levelFor(u.points) }))
        .sort((a, b) => b.points - a.points);
      return { group: { id: g.id, name: g.name, description: g.description, code: isMember ? g.code : null, members, total: members.reduce((t, m) => t + m.points, 0) } };
    },

    // --- Erreurs remontées par les clients
    async reportError(body) {
      const list = (await storage.get('errors')) || [];
      list.push({ at: now().toISOString(), msg: cleanText(body?.msg, 300) || '', route: cleanText(body?.route, 80) || '', version: cleanText(body?.version, 20) || '' });
      await storage.set('errors', list.slice(-200));
      return { ok: true };
    },

    // --- Administration
    async adminStats(headers) {
      adminAuth(headers);
      const users = await allUsers();
      const today = new Date(dayOf(now()));
      const day = (offset) => dayOf(new Date(today.getTime() - offset * 86400000));
      const activeIn = (n) => users.filter((u) => u.activeDays.some((d) => d >= day(n - 1))).length;
      const retention = (n) => {
        const cohort = users.filter((u) => u.firstSeen <= day(n));
        if (!cohort.length) return null;
        const back = cohort.filter((u) => {
          const target = dayOf(new Date(new Date(u.firstSeen).getTime() + n * 86400000));
          return u.activeDays.some((d) => d >= target);
        });
        return Math.round((back.length / cohort.length) * 100);
      };
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const s = (await storage.get(`stats/${day(i)}`)) || { day: day(i), actions: {}, activeUsers: [] };
        days.push({ day: s.day, active: s.activeUsers.length, actions: Object.values(s.actions).reduce((a, b) => a + b, 0), byType: s.actions });
      }
      const communes = {};
      for (const u of users) if (u.commune) communes[u.commune] = (communes[u.commune] || 0) + 1;
      return {
        users: users.length, dau: activeIn(1), wau: activeIn(7), mau: activeIn(30),
        retention: { d1: retention(1), d7: retention(7), d30: retention(30) },
        avgActiveDays: users.length ? Math.round((users.reduce((t, u) => t + u.activeDays.length, 0) / users.length) * 10) / 10 : 0,
        days, communes, errors: ((await storage.get('errors')) || []).slice(-20).reverse(),
      };
    },
    async adminSaveEvent(headers, body) {
      adminAuth(headers);
      const ev = body?.event;
      if (!ev?.id || !/^[a-z0-9-]{3,40}$/.test(ev.id)) throw httpError(400, 'Identifiant invalide (a-z, 0-9, tirets).');
      if (!['global', 'yonne', 'commune'].includes(ev.scope)) throw httpError(400, 'Portée invalide.');
      if (!['actions', 'wins', 'goals', 'quiz', 'missions', 'recruits'].includes(ev.metric)) throw httpError(400, 'Mesure invalide.');
      if (!(ev.target > 0) || !(ev.start <= ev.end)) throw httpError(400, 'Objectif ou dates invalides.');
      const events = (await getEvents()).filter((e) => e.id !== ev.id);
      events.push({ id: ev.id, title: cleanText(ev.title, 80), text: cleanText(ev.text, 300) || '', scope: ev.scope, metric: ev.metric, target: Number(ev.target), start: ev.start, end: ev.end, reward: ev.reward || null });
      await storage.set('content/events', events);
      return { events };
    },
    async adminDeleteEvent(headers, id) {
      adminAuth(headers);
      const events = (await getEvents()).filter((e) => e.id !== id);
      await storage.set('content/events', events);
      return { events };
    },
    async adminPartners(headers) {
      adminAuth(headers);
      return { campaigns: (await storage.get('content/campaigns')) || [] };
    },
    async adminSaveCampaign(headers, body) {
      adminAuth(headers);
      const c = body?.campaign;
      if (!c?.id || !/^[a-z0-9-]{3,40}$/.test(c.id)) throw httpError(400, 'Identifiant invalide.');
      if (!['fictif', 'reel'].includes(c.status)) throw httpError(400, 'Statut : « fictif » ou « reel ».');
      if (c.status === 'reel' && !c.agreementRef) throw httpError(400, 'Un partenariat réel exige une référence d’accord signé.');
      const list = ((await storage.get('content/campaigns')) || []).filter((x) => x.id !== c.id);
      list.push({
        id: c.id, partner: cleanText(c.partner, 60), city: c.city || null, status: c.status, agreementRef: cleanText(c.agreementRef, 60) || null,
        condition: cleanText(c.condition, 120), rewardInGame: cleanText(c.rewardInGame, 120), rewardReal: cleanText(c.rewardReal, 120) || null,
        start: c.start, end: c.end, redemptions: Number(c.redemptions) || 0,
      });
      await storage.set('content/campaigns', list);
      return { campaigns: list };
    },
    async campaigns() {
      const today = dayOf(now());
      const list = ((await storage.get('content/campaigns')) || []).filter((c) => (!c.start || c.start <= today) && (!c.end || c.end >= today));
      return { campaigns: list.map(({ agreementRef, redemptions, ...pub }) => pub) };
    },
  };
  return api;
}
