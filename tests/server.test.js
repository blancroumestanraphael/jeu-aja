import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createService, signToken, verifyToken, MAX_ACTIONS_PER_DAY } from '../server/core.js';
import { memoryStorage } from '../server/storage.js';
import { loadServerContent } from '../server/content.js';
import { route } from '../server/router.js';
import { dailyQuestionId } from '../src/engine/community.js';

const content = loadServerContent();
let clock = new Date('2026-11-24T10:00:00Z');
const svc = () => createService(memoryStorage(), { secret: 's3cret', adminToken: 'adm', content, now: () => clock });
const H = (token) => ({ authorization: `Bearer ${token}` });
let n = 0;
const act = (type, payload) => ({ type, payload, clientId: `c${n++}` });

test('jetons signés : un jeton falsifié est refusé', () => {
  const t = signToken('k', 'u_1');
  assert.equal(verifyToken('k', t), 'u_1');
  assert.equal(verifyToken('k', t.replace('u_1', 'u_2')), null);
  assert.equal(verifyToken('autre', t), null);
});

test('inscription : nom validé, grossièretés refusées', async () => {
  const api = svc();
  await assert.rejects(api.register({ displayName: 'ab' }), /3 à 24/);
  await assert.rejects(api.register({ displayName: 'gros connard' }), /grossièreté/);
  const r = await api.register({ displayName: 'Raph de Sens', commune: 'sens', departement: '89' });
  assert.ok(r.token && r.profile.points === 0 && r.profile.trophies.some((t) => t.id === 'pionnier'));
});

test('anti-triche : réponses vérifiées par le serveur, doublons et plafonds', async () => {
  const api = svc();
  const { token } = await api.register({ displayName: 'Testeur', commune: 'joigny' });
  const good = content.territory.communes.joigny.mission.answer;
  const r1 = await api.submitActions(H(token), { actions: [act('mission', { cityId: 'joigny', answer: (good + 1) % 3 })] });
  assert.equal(r1.gained, 0, 'mauvaise réponse : 0 point');
  const ok = act('mission', { cityId: 'joigny', answer: good });
  const r2 = await api.submitActions(H(token), { actions: [ok] });
  assert.equal(r2.gained, 40);
  const r3 = await api.submitActions(H(token), { actions: [ok, act('mission', { cityId: 'joigny', answer: good })] });
  assert.equal(r3.gained, 0, 'même action renvoyée (idempotent) + mission déjà faite');
  assert.ok(r3.rejected.some((x) => x.reason === 'deja'));
  const fake = await api.submitActions(H(token), { actions: [act('match', { seed: 1, season: '2026-27', week: 1, goalsFor: 40, goalsAgainst: 0 })] });
  assert.equal(fake.rejected[0].reason, 'score');
  const xp = await api.submitActions(H(token), { actions: [{ type: 'xp', payload: { amount: 99999 }, clientId: 'x' }] });
  assert.equal(xp.gained, 0);
  // plafond quotidien par type
  const visits = await api.submitActions(H(token), { actions: [act('visit', { date: '2026-11-24' }), act('visit', { date: '2026-11-24' })] });
  assert.equal(visits.gained, 10);
  assert.equal(visits.rejected[0].reason, 'plafond');
  await assert.rejects(api.submitActions({ authorization: 'Bearer faux.jeton' }, { actions: [] }), /authentifié/);
});

test('question du jour vérifiée à la date du serveur', async () => {
  const api = svc();
  const { token } = await api.register({ displayName: 'Quiz' });
  const qid = dailyQuestionId(content.heritage, '2026-11-24');
  const ans = content.heritage.questions[qid].answer;
  const old = await api.submitActions(H(token), { actions: [act('daily', { date: '2026-11-20', answer: ans })] });
  assert.equal(old.rejected[0].reason, 'date');
  const r = await api.submitActions(H(token), { actions: [act('daily', { date: '2026-11-24', answer: ans })] });
  assert.equal(r.gained, 15);
});

test('classements : général, communes, départements, ancienneté, groupes', async () => {
  const api = svc();
  const a = await api.register({ displayName: 'Alice', commune: 'sens', departement: '89' });
  const b = await api.register({ displayName: 'Bruno', commune: 'avallon', departement: '89' });
  const c = await api.register({ displayName: 'Chloé', departement: '75' });
  await api.submitActions(H(a.token), { actions: [act('activity', { cityId: 'sens' }), act('recruit', {})] });
  await api.submitActions(H(b.token), { actions: [act('activity', { cityId: 'avallon' })] });
  await api.submitActions(H(c.token), { actions: [act('match', { seed: 2, season: '2026-27', week: 1, goalsFor: 2, goalsAgainst: 0 })] });
  const g = await api.leaderboard('general', { meId: b.userId });
  assert.deepEqual(g.rows.map((r) => r.name), ['Alice', 'Bruno', 'Chloé']);
  assert.equal(g.me.rank, 2);
  const com = await api.leaderboard('commune');
  assert.equal(com.rows[0].name, 'Sens');
  const dep = await api.leaderboard('departement');
  assert.equal(dep.rows[0].id, '89');
  assert.equal(dep.rows[0].value, 60);
  const grp = await api.createGroup(H(a.token), { name: 'Les Ultras de Sens' });
  await api.joinGroup(H(b.token), { code: grp.group.code });
  const gl = await api.leaderboard('groupes');
  assert.equal(gl.rows[0].value, 60);
  const view = await api.group(grp.group.id, {});
  assert.equal(view.group.code, null, 'le code n’est visible que des membres');
  assert.equal(view.group.members.length, 2);
  clock = new Date('2026-12-04T10:00:00Z');
  const anc = await api.leaderboard('anciennete');
  assert.equal(Math.floor(anc.rows[0].value), 11);
  clock = new Date('2026-11-24T10:00:00Z');
});

test('défi de territoire : seuls les joueurs de l’Yonne y contribuent, badge à l’objectif', async () => {
  const storage = memoryStorage();
  const api = createService(storage, { secret: 's', adminToken: 'adm', content, now: () => clock });
  await api.adminSaveEvent(H('adm'), { event: { id: 'mini-yonne', title: 'Mini défi', scope: 'yonne', metric: 'actions', target: 3, start: '2026-11-01', end: '2026-12-31', reward: { badge: 'Mini', icon: '⭐' } } });
  const y = await api.register({ displayName: 'Icaunais', commune: 'tonnerre', departement: '89' });
  const p = await api.register({ displayName: 'Parisien', departement: '75' });
  await api.submitActions(H(p.token), { actions: [act('activity', { cityId: 'sens' })] });
  await api.submitActions(H(y.token), { actions: [act('activity', { cityId: 'tonnerre' }), act('recruit', {}), act('keyMatch', {})] });
  const ev = (await api.events()).events.find((e) => e.id === 'mini-yonne');
  assert.equal(ev.progress, 3);
  assert.equal(ev.completed, true);
  assert.equal(ev.communes[0].name, 'Tonnerre');
  const prof = await api.profile(y.userId);
  assert.ok(prof.profile.trophies.some((t) => t.title === 'Mini'));
  await assert.rejects(api.adminSaveEvent(H('pas-admin'), { event: {} }), /administrateur/);
});

test('plafond global d’actions par jour', async () => {
  const api = svc();
  const { token } = await api.register({ displayName: 'Robot' });
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const r = await api.submitActions(H(token), { actions: Array.from({ length: 100 }, (_, k) => act('quiz', { qid: Object.keys(content.heritage.questions)[k % 20], answer: 0 })) });
    total += r.accepted.length;
  }
  assert.ok(total <= MAX_ACTIONS_PER_DAY);
});

test('partenaires : un partenariat réel exige une référence d’accord, le public ne la voit pas', async () => {
  const api = svc();
  await assert.rejects(api.adminSaveCampaign(H('adm'), { campaign: { id: 'boul', partner: 'Boulangerie', status: 'reel' } }), /accord/);
  await api.adminSaveCampaign(H('adm'), { campaign: { id: 'boul', partner: 'Boulangerie', status: 'reel', agreementRef: 'CONV-2027-01', condition: 'Mission de Sens', rewardInGame: 'Badge', rewardReal: '-10 %' } });
  const pub = await api.campaigns();
  assert.equal(pub.campaigns[0].agreementRef, undefined);
  const st = await api.adminStats(H('adm'));
  assert.equal(typeof st.users, 'number');
});

test('routeur HTTP', async () => {
  const api = svc();
  assert.equal((await route(api, 'GET', '/api/health', null, {})).status, 200);
  assert.equal((await route(api, 'GET', '/api/nope', null, {})).status, 404);
  assert.equal((await route(api, 'GET', '/api/me', null, {})).status, 401);
});

test('serveur de développement : jeu + API sur le même port', async () => {
  const port = 5600 + Math.floor(Math.random() * 300);
  const child = spawn(process.execPath, ['server/dev-server.js'], { env: { ...process.env, PORT: String(port), AJA_SECRET: 't', AJA_DB: `/tmp/claude-0/aja-test-${port}.json` }, stdio: 'pipe' });
  try {
    await new Promise((res, rej) => { child.stdout.on('data', (d) => String(d).includes('localhost') && res()); setTimeout(() => rej(new Error('démarrage')), 4000); });
    const base = `http://localhost:${port}`;
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/server/core.js`)).status, 404, 'le code serveur n’est pas servi');
    const reg = await (await fetch(`${base}/api/register`, { method: 'POST', body: JSON.stringify({ displayName: 'HTTP Test' }) })).json();
    const me = await (await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${reg.token}` } })).json();
    assert.equal(me.profile.displayName, 'HTTP Test');
  } finally {
    child.kill();
  }
});
