// Progression communautaire locale du prototype Génération AJA.
// Les points et défis sont attachés à la sauvegarde du joueur : aucune donnée n'est envoyée à un serveur.

export function ensureCommunity(save) {
  if (!save) return save;
  if (!save.community) {
    save.community = {
      displayName: 'Supporter AJA',
      xp: 0,
      collectivePoints: 0,
      visitedCities: [],
      claimedChallenges: [],
      weekly: { week: save.week, activities: 0, newCity: false, recruits: 0, viewedHeritage: false },
    };
  }
  const c = save.community;
  c.displayName ||= 'Supporter AJA';
  c.xp = Number.isFinite(c.xp) ? c.xp : 0;
  c.collectivePoints = Number.isFinite(c.collectivePoints) ? c.collectivePoints : c.xp;
  c.visitedCities = Array.isArray(c.visitedCities) ? c.visitedCities : [];
  c.claimedChallenges = Array.isArray(c.claimedChallenges) ? c.claimedChallenges : [];
  if (!c.weekly || c.weekly.week !== save.week) {
    c.weekly = { week: save.week, activities: 0, newCity: false, recruits: 0, viewedHeritage: false };
  }
  return save;
}

export function awardCommunity(save, points, event = {}) {
  ensureCommunity(save);
  const c = save.community;
  const amount = Math.max(0, Math.round(points));
  c.xp += amount;
  c.collectivePoints += amount;
  if (event.activity) c.weekly.activities += 1;
  if (event.cityId) {
    if (!c.visitedCities.includes(event.cityId)) {
      c.visitedCities.push(event.cityId);
      c.weekly.newCity = true;
    }
  }
  if (event.recruit) c.weekly.recruits += 1;
  return amount;
}

export function claimChallenge(save, challengeId, points) {
  ensureCommunity(save);
  const key = `${save.week}:${challengeId}`;
  if (save.community.claimedChallenges.includes(key)) return false;
  save.community.claimedChallenges.push(key);
  awardCommunity(save, points);
  return true;
}
