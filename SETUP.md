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

## Web local provisoire

Le dossier `web/` contient des pages de substitution, sans connexion ni données Firebase. Avec Node 26 et `nvm`, depuis la racine :

```sh
cd web && nvm install && nvm use && npm ci --ignore-scripts && cd ..
./web/dev start
./web/dev status
./web/dev reload
./web/dev stop
```

La vitrine est disponible sur `http://localhost:3000/` et les pages de substitution sur `http://test-club.localhost:3000/` et `http://admin.localhost:3000/`. Le gestionnaire n'arrête que son propre processus ; un service étranger occupant le port 3000 est laissé intact. Pour les journaux, la résolution des sous-domaines et les limites, voir [web/README.md](web/README.md). Pour l’émulateur App Hosting, arrêter `./web/dev` puis, depuis `backend/` avec Node 26 et Java 21 : `firebase emulators:exec --project demo-assodarts-rules --only apphosting,firestore 'curl -fsS http://localhost:5002/'`. Redémarrer ensuite avec `./web/dev start`.

Le lockfile web utilise le registre npm public ; l'installation a réussi localement. Le lockfile `shared/` contient encore des URL d'un registre privé et bloque la CI publique : voir [le suivi](docs/SUIVI-CHANTIERS.md).

## CI et environnements

La CI est définie dans `.github/workflows/quality.yml` et le déploiement backend dans `.github/workflows/deploy-firebase.yml`. Consulter [SECURITE-CI.md](docs/web/SECURITE-CI.md) pour les conditions de lancement, les contrôles requis et les limitations. Un lancement manuel de `Quality` ne déploie rien par défaut. Les options `deploy_staging` et `distribute_ios` sont explicites. Aucun déploiement en production ne doit être lancé sans validation du propriétaire.

La CI du commit de référence était encore en cours et comportait des échecs connus au moment de la rédaction ; voir [SUIVI-CHANTIERS.md](docs/SUIVI-CHANTIERS.md).
