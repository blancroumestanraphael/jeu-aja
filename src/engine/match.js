// Moteur de match : 18 tranches de 5 minutes, occasions proportionnelles à la force, conversion 0,25 × att/déf.

export const SLICES = 18;
export const CHANCE_K = 0.55; // probabilité d'occasion par tranche à force égale ≈ 0,275
export const SHARE_EXP = 4; // accentue l'écart de force (à équilibrer)
export const HOME_BONUS = 1.03;
export const CARD_P = 0.035;

export const TACTICS = {
  defensive: { label: 'Défensive', strength: 0.95, concede: 0.92 },
  equilibre: { label: 'Équilibrée', strength: 1.0, concede: 1.0 },
  offensive: { label: 'Offensive', strength: 1.05, concede: 1.08 },
};

/** Consignes du Match de la veille (temps forts). */
export const INSTRUCTIONS = {
  presser: { label: 'Presser haut', desc: 'Plus d’occasions, mais on s’expose.', chance: 1.25, conv: 1.0, concede: 1.15 },
  contre: { label: 'Jouer le contre', desc: 'Moins d’occasions, plus tranchantes.', chance: 0.85, conv: 1.35, concede: 0.9 },
  bloc: { label: 'Bloc bas', desc: 'On ferme tout, on attend.', chance: 0.7, conv: 1.0, concede: 0.65 },
};

const WEIGHTS_SCORER = { GK: 0.02, DEF: 0.5, MIL: 1.6, ATT: 3 };
const WEIGHTS_CARD = { GK: 0.2, DEF: 2, MIL: 1.5, ATT: 0.6 };

export function teamStrength(team) {
  const tactic = TACTICS[team.tactic] || TACTICS.equilibre;
  // Moral : effet modéré (0,92 à 1,08) pour éviter les spirales de défaites
  const moraleFactor = 0.92 + 0.16 * ((team.morale ?? 70) / 100);
  // factor : plan de jeu face à l'adversaire × cohésion du groupe (équipe 1)
  return team.rating * tactic.strength * moraleFactor * (team.isHome ? HOME_BONUS : 1) * (team.factor ?? 1);
}

export function newMatchState() {
  return { slice: 0, homeGoals: 0, awayGoals: 0, events: [], finished: false };
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/**
 * Joue les tranches [state.slice, toSlice[ et renvoie un nouvel état.
 * mods = { home: {chance, conv, concede}, away: {...} } (consignes temporaires)
 */
export function playSlices(state, home, away, rng, toSlice, { mods = {}, templates = null, stadium = '' } = {}) {
  const s = { ...state, events: state.events.slice() };
  const sh = teamStrength(home);
  const sa = teamStrength(away);
  const shareHome = sh ** SHARE_EXP / (sh ** SHARE_EXP + sa ** SHARE_EXP);
  const sides = [
    { key: 'home', team: home, opp: away, share: shareHome },
    { key: 'away', team: away, opp: home, share: 1 - shareHome },
  ];
  const tpl = templates;
  const score = () => `${home.short || home.name} ${s.homeGoals}-${s.awayGoals} ${away.short || away.name}`;
  const say = (type, minute, side, vars) => {
    if (!tpl) {
      s.events.push({ minute, type, side });
      return;
    }
    const text = fill(rng.pick(tpl[type]), { ...vars, score: score(), home: home.name, away: away.name, stadium });
    s.events.push({ minute, type, side, text, ...(vars.playerId ? { playerId: vars.playerId } : {}) });
  };

  if (s.slice === 0 && tpl) say('kickoff', 0, null, {});

  for (; s.slice < Math.min(toSlice, SLICES); s.slice++) {
    for (const side of sides) {
      const m = mods[side.key] || {};
      const oppM = mods[side.key === 'home' ? 'away' : 'home'] || {};
      const oppTactic = TACTICS[side.opp.tactic] || TACTICS.equilibre;
      const pChance = Math.min(0.9, CHANCE_K * side.share * (m.chance ?? 1));
      if (rng.chance(pChance)) {
        const minute = s.slice * 5 + rng.int(1, 5);
        const pGoal = Math.max(
          0.05,
          Math.min(0.6, 0.25 * (side.team.attack / side.opp.defense) * (m.conv ?? 1) * oppTactic.concede * (oppM.concede ?? 1)),
        );
        const shooter = pickPlayer(rng, side.team.players, WEIGHTS_SCORER);
        const vars = { team: side.team.name, player: shooter?.name || side.team.short || side.team.name, playerId: shooter?.id };
        if (rng.chance(pGoal)) {
          if (side.key === 'home') s.homeGoals++;
          else s.awayGoals++;
          say('goal', minute, side.key, vars);
        } else {
          say('chance', minute, side.key, vars);
        }
      }
      if (rng.chance(CARD_P)) {
        const p = pickPlayer(rng, side.team.players, WEIGHTS_CARD);
        say(rng.chance(0.07) && (!tpl || tpl.red) ? 'red' : 'card', s.slice * 5 + rng.int(1, 5), side.key, { team: side.team.name, player: p?.name || side.team.short || side.team.name, playerId: p?.id });
      }
    }
    if (s.slice === 8 && tpl) say('halftime', 45, null, {});
  }
  s.events.sort((a, b) => a.minute - b.minute);
  if (s.slice >= SLICES && !s.finished) {
    s.finished = true;
    if (tpl) say('fulltime', 90, null, {});
  }
  return s;
}

function pickPlayer(rng, players, weights) {
  if (!players || players.length === 0) return null;
  return rng.weighted(players, (p) => weights[p.group] ?? 1);
}

/** Match complet en une fois. */
export function simulateMatch(home, away, rng, opts = {}) {
  return playSlices(newMatchState(), home, away, rng, SLICES, opts);
}

/** Équipe adverse à niveau fixe. */
export function clubTeam(club, { isHome = false, tactic = 'equilibre' } = {}) {
  return {
    id: club.id,
    name: club.name,
    short: club.short,
    rating: club.level,
    attack: club.level,
    defense: club.level,
    morale: 70,
    tactic,
    isHome,
    players: [],
  };
}
