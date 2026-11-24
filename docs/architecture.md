# Génération AJA — architecture et exploitation

Ce document décrit l'architecture technique de la V4 et le passage d'un prototype à un produit exploité.

## Vue d'ensemble

```
Navigateur / PWA (index.html)
  src/engine     moteur de jeu PUR (aucun accès au DOM ni au réseau)
  src/state      sauvegarde locale versionnée, file d'actions, client API, télémétrie
  src/screens    écrans
  src/ui         composants
       │  actions (jamais des points)          ▲ classements, défis, profils
       ▼                                        │
API /api/* ── server/router.js ── server/core.js (règles, anti-triche, classements, défis, admin)
                                         │
                                   server/storage.js
                          fichier JSON (dev) · Netlify Blobs (prototype en ligne) · Firestore (cible)
admin.html  ── tableau de bord (stats, rétention, événements, campagnes partenaires, erreurs)
```

Le moteur de jeu (`src/engine`) est partagé par le navigateur, les tests et le serveur. Le serveur s'en sert par exemple pour la question du jour et le quiz de la semaine. C'est ce qui permet une application native sans réécrire le jeu (voir plus bas).

## Lancer en local

```bash
npm install
npm start          # jeu + API sur http://localhost:5173, admin sur /admin.html (jeton « admin-dev »)
npm test           # 59 tests : moteur, serveur (dont HTTP réel), migrations, communauté, musée
npm run balance    # contrôle d'équilibrage sur 30 saisons simulées
```

Variables du serveur :

| Variable | Rôle |
| --- | --- |
| `AJA_SECRET` | Clé de signature des jetons. **Obligatoire en production.** |
| `AJA_ADMIN_TOKEN` | Jeton du tableau de bord administrateur. |
| `AJA_DB` | Fichier de données en local (défaut `.data/db.json`). |
| `PORT` | Port du serveur de développement. |

## Déploiement Netlify

1. Connecter le dépôt GitHub à Netlify. Le dossier publié est la racine, `netlify.toml` est fourni.
2. Définir `AJA_SECRET` (une longue chaîne aléatoire) et `AJA_ADMIN_TOKEN` dans les variables d'environnement du site.
3. La fonction `netlify/functions/api.mjs` répond sur `/api/*` et stocke les données dans Netlify Blobs.

## Règles côté serveur (anti-triche)

- Le client n'envoie que des **actions** (`mission`, `quiz`, `weekQuiz`, `daily`, `match`, `activity`, `recruit`, `alumni`, `keyMatch`, `visit`), jamais des points.
- Réponses vérifiées par le serveur :
  - missions de commune ;
  - questions du musée ;
  - question du jour, à la date du serveur ;
  - quiz de la semaine : la question doit appartenir à la semaine en cours.
- Plafonds :
  - par type d'action et par jour, et 150 actions par jour au total ;
  - scores de match bornés, un seul match par semaine de jeu.
- Chaque action porte un identifiant unique : un doublon est ignoré (envoi idempotent).
- L'ancienneté est calculée à partir de la date d'inscription **enregistrée par le serveur**.
- Les noms et présentations sont filtrés (longueur, caractères, grossièretés).
- Les jetons sont signés en HMAC-SHA256.

**Limite connue :** les matchs sont simulés dans le navigateur. Le serveur plafonne les scores mais ne les rejoue pas. Prochaine étape : le serveur rejoue le match à partir de la graine et de la composition, puisque le moteur est déterministe.

## Passer à l'exploitation

| Chantier | Prototype actuel | Cible |
| --- | --- | --- |
| Comptes | Jeton lié à l'appareil, pseudonyme | Firebase Authentication (e-mail, Google, Apple) ; le serveur vérifie le jeton Firebase au lieu du HMAC (`verifyToken`) |
| Sauvegardes | Locale (localStorage), versionnée, migrations, export/import | Synchronisation multi-appareils : document `saves/{uid}` dans Firestore (code prêt dans `src/state/store.js`) |
| Données communautaires | Netlify Blobs (clé-valeur, sans transactions) | Firestore : compteurs d'événements en transactions, classements pré-agrégés (Cloud Functions planifiées), index par commune et département |
| Sécurité | Règles dans `server/core.js` | Mêmes règles + limitation de débit par adresse IP, journal d'audit admin, rejeu serveur des matchs |
| Administration | `admin.html` (stats, rétention J1/J7/J30, événements, campagnes, erreurs) | Rôles (club, partenaires), export CSV, modération des profils |
| Contenus | JSON versionnés (`src/data`, `server/content`) + événements éditables dans l'admin | CMS léger pour les missions, le musée et les événements, validé par le club |
| Partenaires | Campagnes « fictif » / « réel » (référence d'accord obligatoire pour un partenaire réel) | Gestion des campagnes, codes de récompense à usage unique, suivi des utilisations |
| Technique | 59 tests, journal d'erreurs client remonté au serveur | Intégration continue (GitHub Actions : `npm test`), suivi d'erreurs (Sentry), sauvegardes de la base |

## Application native (stores)

Le jeu est une PWA en JavaScript standard, et le moteur est pur. Pour publier sur les stores sans réécriture, on l'emballe avec **Capacitor**. Il faudra :

- pointer `backendConfig.baseUrl` vers l'URL de production ;
- remplacer les notifications locales par des notifications push (Firebase Cloud Messaging).

## Données personnelles (RGPD)

- **Collecte minimale.** Le jeu ne demande ni e-mail ni nom réel. Il conserve un pseudonyme, une commune et un département facultatifs, une année « supporter depuis » et des statistiques de jeu.
- **Mineurs.** Le jeu peut toucher des mineurs. Avant l'ouverture publique :
  - prévoir le consentement parental sous 15 ans ;
  - prévoir la suppression du compte sur demande ;
  - publier une politique de confidentialité validée par le club.
- **Joueurs du centre de formation.** Les jeunes du jeu restent fictifs. Utiliser de vrais jeunes demanderait l'accord du club et des familles (droit à l'image).
- **Contenus protégés.** Les photos, logos et archives demandent l'autorisation du club et des ayants droit.
