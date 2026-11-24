// Match de la veille : ouvert la veille du vrai match, de 18 h à minuit ; 3 temps forts avec consigne.

import { createRng, hashSeed } from './rng.js';
import { clubTeam, newMatchState, playSlices, INSTRUCTIONS, SLICES } from './match.js';
import { firstTeamMatchTeam, clubById, fixtureOfWeek, supporterMoraleBonus } from './week.js';
import { applyEvent } from './community.js';
import { ensureAvailableLineup, planFactor, cohesionFactor } from './squad.js';

export const KEY_MOMENTS = [3, 9, 14]; // tranches (≈ 15e, 45e, 70e minute)

/** Fenêtre réelle : veille du match, 18:00 → 23:59 (heure locale). */
export function keyMatchWindow(fixture, now = new Date()) {
  const [y, m, d] = fixture.realDate.split('-').map(Number);
  const opens = new Date(y, m - 1, d - 1, 18, 0, 0);
  const closes = new Date(y, m - 1, d, 0, 0, 0);
  return { open: now >= opens && now < closes, opens, closes, past: now >= closes };
}

export function canPlayKeyMatch(save, data, now = new Date()) {
  const f = fixtureOfWeek(data, save.week);
  if (!f || !f.isKeyMatch || save.seasonOver) return { ok: false, fixture: f };
  if (save.keyResults[save.week]) return { ok: false, fixture: f, played: true };
  const w = keyMatchWindow(f, now);
  return { ok: w.open || save.settings.demoKeyMatch, fixture: f, window: w, demo: !w.open };
}

/** Prépare une session interactive (le rng est conservé par l'écran pendant le match). */
export function createKeyMatch(save, data) {
  const f = fixtureOfWeek(data, save.week);
  const club = clubById(data, f.opponent);
  const draft = structuredClone(save);
  ensureAvailableLineup(draft);
  const aja = firstTeamMatchTeam(draft, data, f.home, supporterMoraleBonus(save, data, f));
  aja.factor = planFactor(draft.teams.A.plan, club.style, save.staff?.analyste) * cohesionFactor(save.cohesion);
  const opp = clubTeam(club, { isHome: !f.home });
  return {
    fixture: f,
    club,
    home: f.home ? aja : opp,
    away: f.home ? opp : aja,
    ajaSide: f.home ? 'home' : 'away',
    rng: createRng(hashSeed(save.seed, save.season, save.week, 'keymatch')),
    state: newMatchState(),
    choices: [],
  };
}

export function playKeySegment(km, data, instructionKey) {
  const idx = km.choices.length; // 0 = avant le 1er temps fort
  const to = idx < KEY_MOMENTS.length ? KEY_MOMENTS[idx] : SLICES;
  const mods = {};
  if (instructionKey && INSTRUCTIONS[instructionKey]) mods[km.ajaSide] = INSTRUCTIONS[instructionKey];
  const stadium = km.fixture.home ? clubById(data, 'auxerre').stadium : km.club.stadium;
  km.state = playSlices(km.state, km.home, km.away, km.rng, to, { mods, templates: data.commentary, stadium });
  return km.state;
}

/** Enregistre le résultat du Match de la veille (pur). */
export function saveKeyResult(save0, km) {
  const save = structuredClone(save0);
  const st = km.state;
  save.keyResults[save.week] = { homeGoals: st.homeGoals, awayGoals: st.awayGoals, events: st.events, choices: km.choices.slice() };
  applyEvent(save, 'keyMatch');
  return save;
}
