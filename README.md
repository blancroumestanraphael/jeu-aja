# Génération AJA

Prototype de jeu mobile (PWA) pour **fidéliser les supporters de l'AJ Auxerre** et les attacher au club et à son territoire. Le cœur ludique est une gestion du club axée sur la formation : équipe 1 sur le vrai calendrier de Ligue 1 2026-27, U19 gérés, U17 et U15 simulés, Match de la veille. Autour de ce cœur :

- **Yonne** : 8 communes à découvrir. Chacune a une présentation et une mission (son histoire, son club local) qui débloque le recrutement. La carte montre les lieux de l'AJA et les partenaires locaux. Un classement suit le rayonnement des communes.
- **Patrimoine** : 5 époques de l'AJA avec une mission historique chacune et des objets de collection à débloquer. On y trouve aussi les moments clés, les figures, le centre de formation et le livre d'or de votre centre.
- **Supporter** : profil (commune de cœur, génération), ancienneté et série de jours, niveaux qui ont des effets dans le jeu, statistiques, défis hebdomadaires, défis collectifs et succès.
- **Club → Contrats** : masse salariale, valeur estimée de l'effectif, fins de contrat et prêts. On négocie salaire, durée et rôle promis, avec offre, contre-offre et nombre d'offres limité par semaine. Un premier contrat pro protège un U19 des clubs rivaux. Chaque fiche joueur a une carte « Contrat & valeur » avec la courbe réelle et projetée.
- **Accueil** : prochain vrai match de l'AJA, question du jour, mission suggérée.

Positionnement, parcours, feuille de route et mesure de l'engagement : voir [`docs/positionnement.md`](docs/positionnement.md).
## Lancer le jeu

```bash
npm install
npm start
```

Le jeu et l'API communautaire tournent alors sur http://localhost:5173. Le tableau de bord administrateur est sur `/admin.html`, avec le jeton `admin-dev`. Sur téléphone, utiliser « Ajouter à l'écran d'accueil ». Sans serveur, avec un simple `python3 -m http.server`, le jeu reste jouable : les actions communautaires attendent dans la sauvegarde.

Le déploiement sur Netlify (site statique + fonction `/api`), la sécurité et le passage à l'exploitation sont décrits dans [`docs/architecture.md`](docs/architecture.md).

## Tests

```bash
npm test
npm run balance
```

- **`npm test`** : 59 tests sur le moteur, le serveur (y compris par HTTP), l'anti-triche, les migrations, la communauté, le mercato, le musée et l'agenda.
- **`npm run balance`** : contrôle d'équilibrage sur 30 saisons simulées.

## Organisation

```
index.html, styles.css, manifest.json, sw.js   PWA (installation + cache hors ligne)
admin.html, src/admin                          tableau de bord administrateur
server/                                        API communautaire (cœur pur, routeur, stockage, serveur de dev)
netlify/functions/api.mjs                      la même API en fonction Netlify
scripts/balance.mjs                            contrôle d'équilibrage
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
- **Contrats** : prêts réels (Faivre, Archer, Labeau-Lascary), autres fins de contrat estimées. Salaires et valeurs marchandes calculés par le jeu, ce ne sont pas des données Transfermarkt.
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
