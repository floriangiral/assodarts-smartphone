# Configuration locale

Cette page décrit l'état du dépôt au 5 novembre 2026. Ne pas confondre un serveur local de développement avec un déploiement staging ou production. L'état et les limites connus se trouvent dans [docs/SUIVI-CHANTIERS.md](docs/SUIVI-CHANTIERS.md).

## iOS

Ouvrir `ios-assodarts/Assodarts.xcodeproj` dans Xcode, choisir le schéma `Assodarts`, un simulateur puis lancer le projet. La configuration Firebase est nécessaire aux parcours authentifiés : l'absence de configuration ne démarre pas un mode de démonstration utilisable.

Les configurations `Debug` et `Staging` ciblent staging ; `Release` cible la production. `Staging` utilise `com.assodarts.app.staging` ; les configurations principales utilisent `com.assodarts.app`. Vérifier les réglages Xcode et les profils avant signature. Les fichiers `GoogleService-Info.plist` et `FirebaseConfig.plist` sont locaux et ignorés par Git ; leur emplacement et la génération sont décrits dans `ios-assodarts/Config/` et `Config/generate-firebase-config.sh`.

Les valeurs Firebase distribuées au client sont des identifiants publics, non des secrets serveur. Les clés de signature, mots de passe, jetons et comptes de service ne doivent pas être commités.

## Functions et règles

Dans un shell avec `nvm` :

```sh
cd backend/functions
nvm install
nvm use
npm ci --ignore-scripts
npm run build
npm run lint
npm test -- --runInBand
```

Les tests de règles requièrent Java 21, Firebase CLI 15.35.0 et les dépendances installées ci-dessus. Depuis `backend/` :

```sh
firebase emulators:exec --project demo-assodarts-rules --only firestore,storage 'npm --prefix functions run test:rules'
```

Cette commande utilise un projet `demo-` et les règles locales. Elle ne déploie rien. Les premiers scénarios d'isolation et de photos ont réussi localement ; ils ne couvrent pas encore tous les flux métier. `backend/firebase.json` configure également l’émulateur App Hosting sur le port 5002, avec `web/` comme racine.

Le projet staging peut aussi être alimenté par `backend/scripts/seed-staging.js` : examiner les options du script et la cible avant toute exécution. Il s'agit d'une action sur un projet réel, distincte des émulateurs.

## Web local

Les pages publiques lisent des projections Firestore; le portail responsable utilise Firebase Auth et les memberships/roles existants. Pour essayer les vues publiques et les quatre profils locaux sans données réelles, installer Node 26, Java 21 et les dépendances, puis lancer la démonstration :

```sh
cd web && nvm install && nvm use && npm ci --ignore-scripts && cd ..
./web/demo start
./web/demo status
./web/demo restart
./web/demo stop
```

La vitrine est sur http://localhost:3000/, le club fictif sur http://localhost:3000/?club=club-a et l'espace responsable sur http://admin.localhost:3000/. `./web/demo` lance Auth Emulator (9099) et Firestore Emulator (8080), puis sème les profils membre, bureau, admin club et développeur plateforme dans le projet isolé `demo-assodarts-web`; aucune ressource Firebase réelle n'est modifiée. Les identifiants sont dans [web/README.md](web/README.md). Le serveur seul reste disponible avec `./web/dev`, mais il ne connecte pas automatiquement les émulateurs. Pour le détail des pages, prérequis et ports, voir [web/README.md](web/README.md). Le lockfile `shared/` utilise le registre npm public.

## CI et environnements

La CI est définie dans `.github/workflows/quality.yml` et le déploiement backend dans `.github/workflows/deploy-firebase.yml`. Consulter [SECURITE-CI.md](docs/web/SECURITE-CI.md) pour les conditions de lancement, les contrôles requis et les limitations. Un lancement manuel de `Quality` ne déploie rien par défaut. Les options `deploy_staging` et `distribute_ios` sont explicites. Aucun déploiement en production ne doit être lancé sans validation du propriétaire.

La CI du commit de référence était encore en cours et comportait des échecs connus au moment de la rédaction ; voir [SUIVI-CHANTIERS.md](docs/SUIVI-CHANTIERS.md).
