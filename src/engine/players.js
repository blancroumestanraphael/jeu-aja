// Joueurs : note générale, groupes de postes, génération des jeunes (fonctions pures).

export const ATTRS = ['technique', 'physique', 'mental', 'vision'];
export const ATTR_LABELS = { technique: 'Technique', physique: 'Physique', mental: 'Mental', vision: 'Vision' };

export const POSITION_GROUP = {
  G: 'GK', DC: 'DEF', DD: 'DEF', DG: 'DEF',
  MDC: 'MIL', MC: 'MIL', MOC: 'MIL', MD: 'MIL', MG: 'MIL',
  AD: 'ATT', AG: 'ATT', BU: 'ATT',
};

// Profils (somme nulle) : la moyenne des 4 attributs reste égale à la note EA FC.
const PROFILE = {
  GK: { technique: -4, physique: 2, mental: 4, vision: -2 },
  DEF: { technique: -4, physique: 4, mental: 3, vision: -3 },
  MIL: { technique: 2, physique: -3, mental: 0, vision: 1 },
  ATT: { technique: 4, physique: 2, mental: -3, vision: -3 },
};

export const groupOf = (p) => POSITION_GROUP[p.position] || 'MIL';

export function overall(p) {
  const a = p.attributes;
  return Math.round((a.technique + a.physique + a.mental + a.vision) / 4);
}

export const fullName = (p) => `${p.firstName} ${p.lastName}`;
export const shortName = (p) => `${p.firstName[0]}. ${p.lastName}`;

/** Potentiel estimé d'un pro à partir de son âge et de sa note. */
export function estimatePotential(ovr, age) {
  if (age <= 20) return Math.min(90, ovr + 10);
  if (age <= 23) return Math.min(88, ovr + 5);
  if (age <= 27) return ovr + 2;
  return ovr;
}

/** Joueur réel (données EA FC) → objet joueur du jeu. */
export function fromRealPlayer(r) {
  const prof = PROFILE[POSITION_GROUP[r.position] || 'MIL'];
  const attributes = {};
  for (const k of ATTRS) attributes[k] = Math.max(30, Math.min(95, r.ovr + prof[k]));
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    age: r.age,
    position: r.position,
    team: 'A',
    originCity: null,
    attributes,
    potential: Math.max(r.ovr, estimatePotential(r.ovr, r.age)),
    morale: 70,
    fitness: 95,
    trainingFocus: 'technique',
    minutesThisSeason: 0,
    isReal: true,
    ovrSource: r.ovrSource,
    history: [],
  };
}

const POS_BY_GROUP = {
  GK: ['G'],
  DEF: ['DC', 'DC', 'DD', 'DG'],
  MIL: ['MDC', 'MC', 'MC', 'MOC', 'MD', 'MG'],
  ATT: ['AD', 'AG', 'BU', 'BU'],
};

/**
 * Génère un jeune fictif.
 * opts: { id, age, team, city: {id, talentBias}, reputation, names, rareAllowed, potBonus, position }
 */
export function generateYouth(rng, opts) {
  const { names } = opts;
  const groupRoll = rng.next();
  const group = opts.group || (groupRoll < 0.1 ? 'GK' : groupRoll < 0.42 ? 'DEF' : groupRoll < 0.75 ? 'MIL' : 'ATT');
  const position = opts.position || rng.pick(POS_BY_GROUP[group]);
  const rep = opts.reputation ?? 20;

  let potential = Math.round(rng.range(60, 78) + (rep >= 50 ? 4 : 0) + (opts.potBonus || 0));
  if (opts.rareAllowed && rep >= 80 && rng.chance(0.35)) potential = rng.int(84, 92);
  potential = Math.max(50, Math.min(94, potential));

  // Plus le jeune est jeune, plus il est loin de son potentiel.
  const ratio = { 13: 0.6, 14: 0.62, 15: 0.66, 16: 0.7, 17: 0.75, 18: 0.79, 19: 0.82 }[opts.age] ?? 0.8;
  const base = potential * ratio;
  const prof = PROFILE[group];
  const bias = opts.city?.talentBias || {};
  const attributes = {};
  for (const k of ATTRS) {
    const v = (base + prof[k] * 0.7 + rng.range(-4, 4)) * (bias[k] || 1);
    attributes[k] = Math.round(Math.max(25, Math.min(potential, v)) * 10) / 10;
  }
  return {
    id: opts.id,
    firstName: rng.pick(names.firstNames),
    lastName: rng.pick(names.lastNames),
    age: opts.age,
    position,
    team: opts.team,
    originCity: opts.city?.id || null,
    attributes,
    potential,
    morale: rng.int(60, 80),
    fitness: 95,
    trainingFocus: rng.pick(ATTRS),
    minutesThisSeason: 0,
    isReal: false,
    familyPriority: rng.pick(['etudes', 'temps', 'club']),
    history: [],
  };
}

/** Étoiles de potentiel (1 à 5). */
export function potentialStars(pot) {
  if (pot >= 86) return 5;
  if (pot >= 80) return 4;
  if (pot >= 74) return 3;
  if (pot >= 66) return 2;
  return 1;
}
