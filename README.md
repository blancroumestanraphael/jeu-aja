# Génération AJA

Jeu mobile (PWA) de gestion de l'AJ Auxerre axé sur la formation et l'engagement des supporters : équipe 1 sur le calendrier de Ligue 1 2026-27, U19 gérés en profondeur, U17/U15 simulés, recrutement dans 8 villes de l'Yonne, « Match de la veille » et espace supporter (XP, défis hebdomadaires, badges et progression territoriale).

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

Tests du moteur et de la progression supporter (Node ≥ 20, sans dépendance) : même graine = même match, formule de progression, saison complète de 34 semaines déterministe, activités de la carte, Match de la veille, montée en équipe 1, attribution XP et récupération unique des défis.

## Organisation

```
index.html, styles.css, manifest.json, sw.js   PWA (installation + cache hors ligne)
src/data     contenu de saison en JSON (joueurs, clubs, calendrier, villes, sponsors, centre, commentaires)
src/engine   simulation pure, progression communautaire, sans DOM, hasard via un générateur à graine
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

**Espace supporter V2 :** progression individuelle locale (XP, niveaux, badges et défis hebdomadaires). Le compteur collectif est pour l'instant propre à une sauvegarde : il ne s'agit pas encore d'un classement ou d'une communauté synchronisée entre supporters. Les contenus historiques officiels et les partenaires réels restent à intégrer après validation du club.

Jeu non officiel, sans lien avec l'AJ Auxerre ni EA SPORTS.

## Sauvegarde

Par défaut, sauvegarde automatique sur l'appareil. Pour activer comptes + Firestore, renseigner `src/state/firebase-config.js` (la connexion Google apparaît alors dans Réglages ; documents `saves/{uid}`).

## Formules (constantes à équilibrer)

- Progression hebdo d'un attribut : `Δ = 0,4 × (P − A)/P × f_entraînement × f_installations × f_tempsDeJeu × f_âge` (`src/engine/progression.js`).
- Match : 18 tranches de 5 min ; occasion ∝ part de la force (moyenne des titulaires × tactique × moral) ; but avec `0,25 × attaque/défense` (`src/engine/match.js`).
- Réputation des villes : +5 à +15 par activité, −1 par semaine sans visite ; ≥ 50 meilleurs jeunes/sponsors, ≥ 80 jeunes rares.
