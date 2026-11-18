// Générateur pseudo-aléatoire à graine (mulberry32). Tout le hasard du jeu passe par ici.

export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p) => next() < p,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(items, weightOf) {
      const total = items.reduce((s, x) => s + weightOf(x), 0);
      let r = next() * total;
      for (const x of items) {
        r -= weightOf(x);
        if (r <= 0) return x;
      }
      return items[items.length - 1];
    },
    shuffle(arr) {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

/** Un flux de hasard dédié et reproductible : (graine de la partie, saison, semaine, usage). */
export function streamFor(save, ...purpose) {
  return createRng(hashSeed(save.seed, save.season, save.week, ...purpose));
}
