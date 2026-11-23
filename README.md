# Génération AJA

Prototype de jeu mobile (PWA) pour **fidéliser les supporters de l'AJ Auxerre** et les attacher au club et à son territoire. Le cœur ludique est une gestion du club axée sur la formation : équipe 1 sur le vrai calendrier de Ligue 1 2026-27, U19 gérés, U17 et U15 simulés, Match de la veille. Autour de ce cœur :

- **Yonne** : 8 communes à découvrir. Chacune a une présentation et une mission (son histoire, son club local) qui débloque le recrutement. La carte montre les lieux de l'AJA et les partenaires locaux. Un classement suit le rayonnement des communes.
- **Patrimoine** : 5 époques de l'AJA avec une mission historique chacune et des objets de collection à débloquer. On y trouve aussi les moments clés, les figures, le centre de formation et le livre d'or de votre centre.
- **Supporter** : profil (commune de cœur, génération), ancienneté et série de jours, niveaux qui ont des effets dans le jeu, statistiques, défis hebdomadaires, défis collectifs et succès.
- **Accueil** : prochain vrai match de l'AJA, question du jour, mission suggérée.

Positionnement, parcours, feuille de route et mesure de l'engagement : voir [`docs/positionnement.md`](docs/positionnement.md).
## Lancer le jeu

Aucun build : HTML/CSS/JavaScript vanilla (modules ES). Il suffit d'un serveur statique :

```bash
python3 -m http.server 5173
```

puis ouvrir http://localhost:5173 (sur téléphone : « Ajouter à l'écran d'accueil »).

Déploiement Netlify : connecter le dépôt GitHub, dossier publié = racine (`netlify.toml` fourni).

## Tests

```bash
npm test
```

Tests du moteur et de la progression supporter (Node ≥ 20, sans dépendance) : même graine = même match, formule de progression, saison complète de 34 semaines déterministe, activités de la carte, Match de la veille, montée en équipe 1, missions de commune, défis hebdomadaires par saison, effets des niveaux, mobilisation, formés installés, ancienneté, patrimoine, partenaires.

## Organisation

```
index.html, styles.css, manifest.json, sw.js   PWA (installation + cache hors ligne)
src/data     contenu en JSON (joueurs, clubs, calendrier, villes, communes, patrimoine, partenaires, centre, commentaires)
src/engine   simulation pure + territoire, patrimoine et espace supporter (community.js), sans DOM, hasard à graine
src/state    état de la partie + sauvegarde (localStorage, Firestore si configuré)
src/screens  un fichier par écran
src/ui       composants réutilisables (carte joueur, jauges, modale, toast)
tests        tests du moteur (node:test)
```

Changer de saison = remplacer les fichiers de `src/data`.

## Données

- **Équipe 1** : vrais joueurs de l'effectif 2026-27 (`isReal: true`). Notes générales EA SPORTS FC 27 quand elles sont connues (`ovrSource: "ea-fc27"`), sinon estimées (`"estime"`). Les 4 attributs du jeu (technique, physique, mental, vision) sont dérivés de la note selon le poste, leur moyenne = la note EA FC. Âges approximatifs.
- **Calendrier** : Ligue 1 2026-27 de l'AJA (J12 et J21 déduites, à vérifier sur le site de la LFP).
- **Clubs adverses** : niveau fixe par club dans `clubs.json`.
- **U19 / U17 / U15** : jeunes générés (`isReal: false`) — ce sont des mineurs, sans données publiques.
- **Sponsors** : commerces locaux fictifs.
- **Blason** : générique (le logo officiel n'est utilisé qu'avec l'accord du club).

- **Communes et patrimoine** (`territory.json`, `heritage.json`) : textes rédigés pour le prototype à partir de faits publics, à relire et enrichir avec le club et les communes.
- **Espace supporter** : la progression est enregistrée dans la sauvegarde (locale ou cloud personnelle). Les défis « collectifs » comptent la progression de la partie. Les classements entre supporters demanderont un serveur (voir `docs/positionnement.md`).

Jeu non officiel, sans lien avec l'AJ Auxerre ni EA SPORTS.

## Sauvegarde

Par défaut, sauvegarde automatique sur l'appareil. Pour activer comptes + Firestore, renseigner `src/state/firebase-config.js` (la connexion Google apparaît alors dans Réglages ; documents `saves/{uid}`).

## Formules (constantes à équilibrer)

- Progression hebdo d'un attribut : `Δ = 0,4 × (P − A)/P × f_entraînement × f_installations × f_tempsDeJeu × f_âge` (`src/engine/progression.js`).
- Match : 18 tranches de 5 min ; occasion ∝ part de la force (moyenne des titulaires × tactique × moral) ; but avec `0,25 × attaque/défense` (`src/engine/match.js`).
- Réputation des villes : +5 à +15 par activité, −1 par semaine sans visite ; ≥ 50 meilleurs jeunes/sponsors, ≥ 80 jeunes rares.
