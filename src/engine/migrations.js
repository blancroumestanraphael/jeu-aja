// Versions de sauvegarde et migrations : une ancienne partie est mise à niveau, jamais effacée.
// Ajouter une étape = incrémenter SAVE_VERSION et ajouter MIGRATIONS[n] (passage de n à n+1).

import { ensureCommunity } from './community.js';
import { ensureContracts } from './contracts.js';

export const SAVE_VERSION = 3;

const MIGRATIONS = {
  // v1 → v2 : espace supporter et contrats (V3 du jeu)
  1: (save, data) => {
    ensureCommunity(save);
    ensureContracts(save, data);
  },
  // v2 → v3 : V4 — finances, blessures, cohésion, staff, statistiques de match, collection, communauté connectée
  2: (save) => {
    save.finances ||= { transferBudget: 6, history: [] };
    save.staff ||= { adjoint: 1, physique: 1, analyste: 1 };
    save.cohesion ??= 60;
    save.teams.A.plan ||= 'possession';
    save.loans ||= [];
    save.transferOffers ||= [];
    save.market ||= { season: null, players: [] };
    save.collection ||= { cards: [], archives: [] };
    save.onboarding ??= { done: true }; // une partie existante n'a pas besoin du tutoriel
    save.sync ||= { pending: [], lastSync: null };
    for (const p of Object.values(save.players)) {
      p.injury ??= null;
      p.suspension ??= 0;
      p.yellow ??= 0;
      p.matchStats ||= { apps: 0, goals: 0, ratingSum: 0 };
      p.careerLog ||= [];
    }
  },
};

/** Renvoie { save, migrated: [versions] } ; lève une erreur si la sauvegarde vient d'une version plus récente. */
export function migrateSave(save0, data) {
  if (!save0 || typeof save0 !== 'object' || !save0.players || !save0.teams) throw new Error('Sauvegarde illisible.');
  const v0 = save0.version || 1;
  if (v0 > SAVE_VERSION) throw new Error(`Sauvegarde créée par une version plus récente du jeu (v${v0}).`);
  const save = structuredClone(save0);
  const migrated = [];
  for (let v = v0; v < SAVE_VERSION; v++) {
    MIGRATIONS[v]?.(save, data);
    save.version = v + 1;
    migrated.push(v + 1);
  }
  // Toujours compléter les champs récents (sauvegardes déjà à jour mais incomplètes)
  ensureCommunity(save);
  ensureContracts(save, data);
  MIGRATIONS[2](save, data);
  return { save, migrated };
}
