# Génération AJA — d'un jeu de gestion à un outil d'engagement supporter

## État V4 : une plateforme d'engagement dont le jeu est le moteur

| Phase | Livré dans le prototype |
| --- | --- |
| 1. Consolidation | Équilibrage vérifié (`npm run balance`), sauvegardes versionnées avec migrations, export/import, journal d'erreurs |
| 2. Communauté connectée | Serveur partagé ; classements général, communes, départements, ancienneté, accomplissements, groupes, générations ; défis de territoire (10 000 actions dans l'Yonne) et événements limités ; groupes de supporters ; profils publics ; anti-triche côté serveur |
| 3. Gameplay enrichi | Mercato (achats, ventes, offres reçues), prêts, blessures et suspensions, cohésion, staff, plan de jeu contre l'adversaire, finances, trajectoires de carrière à 4 saisons |
| 4. Expérience AJA | Musée (époques, matchs historiques, palmarès, légendes, archives), quiz de la semaine, 52 cartes à collectionner, missions locales dans les communes |
| 5. UX et exploitation | Tutoriel, « prochaine étape » et objectifs du jour, rappels, agenda, animations de niveau ; tableau de bord admin (rétention, événements, campagnes partenaires fictives ou réelles) ; architecture documentée |

Les trois dimensions se renforcent mutuellement :

- **Jeu** : chaque semaine jouée alimente les défis collectifs. Les niveaux supporter donnent des bonus dans le jeu.
- **Communauté** : classements, groupes, défis communs et défis entre générations.
- **Territoire** : les missions des communes débloquent le recrutement, alimentent la Coupe des communes et donnent des cartes à collectionner.

Prototype existant, à faire évoluer avec le club : il ne s'agit pas de repartir de zéro, mais de mettre la gestion sportive (le cœur ludique) au service de la relation avec les supporters de l'AJA et du territoire de l'Yonne.

## Positionnement

| Mécanique existante | Ce qu'elle devient dans la V3 |
| --- | --- |
| Recrutement dans l'Yonne | Parcours de découverte : présentation de la commune → mission (histoire locale + club local) → recrutement débloqué → rayonnement collectif |
| Gestion des équipes | Valorisation de la formation : onglet « Club », bandeau « l'ADN de l'AJA », formés « installés » en équipe 1 |
| Livre des anciens | Patrimoine : 5 époques, moments, figures, centre de formation, livre d'or de *votre* centre |
| Sponsors | Partenaires locaux (fictifs dans le prototype), avec une mission de découverte |
| Infrastructures | « Développer le club et son territoire » (internat, réseau de recruteurs dans l'Yonne) |
| Calendrier sportif | Rendez-vous réels : compte à rebours vers le prochain vrai match, Match de la veille |

## Parcours utilisateur (une visite type)

1. **Accueil** : prochain vrai match de l'AJA (date, stade, compte à rebours), niveau supporter et objectifs de la semaine, question du jour sur l'histoire du club, mission suggérée dans une commune.
2. **Yonne** : choisir une commune, lire sa présentation, relever sa mission, recruter un jeune, découvrir un partenaire local. Calques « Lieux de l'AJA » (stade, centre de formation, cathédrale) et « Partenaires ».
3. **Patrimoine** : lire une époque, relever la mission historique (3 questions) et débloquer un objet de collection, plus un effet en jeu (mécène, +rayonnement).
4. **Club** : composition, centre de formation, faire monter un jeune, puis « Semaine suivante » (matchs simulés, Match de la veille avant un grand match).
5. **Supporter** : profil (commune de cœur, génération), ancienneté, progression, statistiques, défis hebdomadaires, défis collectifs, succès.

Raisons de revenir sans match : question du jour, série de jours consécutifs, objectifs hebdomadaires, mobilisation avant un grand match.

## Espace supporter : règles actuelles

- **XP** : visite quotidienne, mission, activité, recrutement, formé installé en équipe 1, questions patrimoine, Match de la veille, semaine jouée.
- **Les niveaux ont un effet dans le jeu** :
  - niveau 2 : billetterie +20 %
  - niveau 3 : +5 % de réussite avec les familles
  - niveau 4 : 3 déplacements par semaine
  - niveau 5 : +5 de moral à domicile
  - niveau 6 : +500 € par semaine
- **Défis collectifs** (progression de la partie dans le prototype) :
  - mobilisation avant un grand match (+5 de moral si l'objectif est atteint)
  - Génération Yonne
  - les 8 communes
  - la relève
  - mémoire vive
- **Succès** : 10 badges. « Passeur de formation » exige un formé réellement installé en équipe 1, avec 270 minutes jouées.

## Ce qui demandera un serveur (version connectée)

- Classement entre supporters, et par commune (somme des points des supporters de chaque commune de cœur).
- Défis collectifs réellement partagés (compteur global, objectif avant un match, compétitions entre communes et entre générations).
- Anti-triche du Match de la veille et « score des supporters ».

Modèle de données prévu dans Firestore :

- `supporters/{uid}` : profil, XP, commune, génération
- `communes/{id}/weekly/{season_week}` : points agrégés
- `challenges/{id}` : objectif, progression globale

Les écritures se feraient via des fonctions serveur (Netlify Functions).

## Partenaires locaux (phase 2)

Chaque partenaire suit déjà une structure dans `src/data/sponsors.json` :

- `category` et `discovery` : mission de découverte
- `rewardInGame` : XP ou badge
- `rewardReal` : récompense réelle éventuelle (réduction, invitation), à négocier et autoriser avec le club et le partenaire ; `null` par défaut
- `fictional` : vrai partenaire ou non

Règle : une mission partenaire par commerce, uniquement s'il est partenaire du club dans la partie. Le partenaire s'intègre ainsi à l'expérience sans en faire un catalogue publicitaire.

## Mesurer l'engagement (test panel)

Réglages → « Exporter mes statistiques (JSON) » : niveau, XP, jours actifs, ancienneté, missions, recrutements, patrimoine, défis récupérés. L'export ne contient aucune donnée personnelle. Indicateurs proposés :

- jours actifs par semaine et série moyenne
- part des supporters qui terminent une mission de commune
- taux de bonnes réponses patrimoine
- défis hebdomadaires récupérés
- rétention à J7 et J30
- satisfaction : questionnaire après le test

## Feuille de route du stage (3 mois)

1. **Mois 1 — Expérience supporter** : audit du prototype, parcours utilisateur, espace supporter, identité visuelle AJA, échanges avec le club et des supporters.
2. **Mois 2 — Ancrage territorial** : contenus des communes validés avec elles, lieux emblématiques, missions, contenus patrimoniaux issus des archives du club, défis collectifs connectés, cadre des partenariats.
3. **Mois 3 — Expérimenter et mesurer** : test auprès d'un panel, analyse des exports et questionnaires, recueil des suggestions, présentation d'une stratégie de déploiement à la direction.

## Points à valider avec le club

- Contenus historiques et territoriaux : relecture, photos, témoignages.
- Logo et vrais visuels.
- Droit à l'image des jeunes : les U19, U17 et U15 restent fictifs.
- Vrais partenaires et récompenses réelles.
- Propriété du code.
