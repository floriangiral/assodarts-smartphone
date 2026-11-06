# Firebase App Hosting — préparation et déploiement

État du 5 novembre 2026 : le backend `assodarts-web-staging` existe dans `assodarts-staging`, région `europe-west4`, connecté au dépôt et à la racine `web/`. L'environnement est `staging`, la branche est `release-v0.1` et les rollouts automatiques App Hosting sont désactivés. **Aucun rollout n'a encore été effectué** ; l'adresse gérée Firebase n'est donc pas une preuve que le site est en ligne. **Ne pas déployer en production sans décision et validation du propriétaire.**

## Préparer les backends

- [ ] Vérifier la facturation et les API requises sur chaque projet, les permissions IAM et les limites de coût.
- [x] Backend staging créé, dépôt connecté, racine `web/` et environnement `staging` configurés et vérifiés par API.
- [x] Runtime staging `nodejs24` sélectionné avec mises à jour automatiques de l'image. Le service ne propose que Node 22 et 24 versionnés ; Node 26 reste utilisé en local. Installation et build depuis une archive locale complète vérifiés en Node 24 ; la présence de `shared/` lors du build Cloud reste à confirmer au premier rollout.
- [x] Rollouts automatiques App Hosting désactivés ; la CI déclenche les rollouts après contrôles.
- [x] Variables GitHub `staging` `FIREBASE_PROJECT_ID=assodarts-staging` et `APPHOSTING_BACKEND_ID=assodarts-web-staging` configurées. Le secret `FIREBASE_SERVICE_ACCOUNT` existe ; ses droits App Hosting doivent encore être vérifiés lors du déploiement. La migration vers OIDC reste ouverte.
- [ ] Une fois staging validé, préparer séparément un backend de production dans `assodarts`, environnement GitHub `production` avec `FIREBASE_PROJECT_ID=assodarts` et son propre `APPHOSTING_BACKEND_ID`. Ne créer les ressources ni ne déployer la production sans validation du propriétaire.

L'adresse Firebase réservée est `https://assodarts-web-staging--assodarts-staging.europe-west4.hosted.app` ; elle ne servira l'application qu'après un rollout réussi. Le routage la reconnaît comme vitrine de staging. Le fichier `apphosting.yaml` ne contient plus de paramètres de production par défaut : un backend doit sélectionner explicitement `staging` ou `production`. Les workflows refusent un environnement incohérent ; le backend de production devra donc sélectionner `production`. La variable `ROOT_DOMAIN` est disponible au build et au runtime pour garantir le `noindex` de staging.

La création assistée est disponible avec `firebase apphosting:backends:create --project assodarts-staging` ; les choix de région, de connexion GitHub et de ressources doivent être confirmés dans la console ou l'assistant. La racine de l'application est `web/`. Les [instructions Firebase de monorepo](https://firebase.google.com/docs/app-hosting/monorepos) et de [rollout](https://firebase.google.com/docs/app-hosting/rollouts) précisent les paramètres.

## Domaines et Auth

- [ ] Staging : `staging.assodarts.app`, `admin.staging.assodarts.app`, `*.staging.assodarts.app`.
- [ ] Production : `assodarts.app`, `www.assodarts.app`, `admin.assodarts.app`, `*.assodarts.app`.
- [ ] Suivre la validation et les enregistrements DNS affichés par Firebase pour chaque backend et attendre les certificats. Préserver les enregistrements explicites, notamment DKIM/SPF Resend : ne pas les supprimer au profit du générique.
- [ ] Firebase Auth : autoriser uniquement les hôtes admin concernés et `localhost` pour le web. Les sous-domaines de club n'ont pas besoin d'Auth.
- [x] Configuration publique de l'app Web staging ajoutée à `apphosting.staging.yaml` (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_APP_ID`). Ces valeurs sont intégrées au bundle Next au build; la clé n'est pas un compte de service et ne donne pas accès aux données sans Firebase Auth et les règles Firestore.
- [x] `WEB_REVALIDATION_URL` est défini dans l'environnement GitHub staging; `WEB_REVALIDATION_SECRET` a été créé dans Secret Manager staging et l'accès App Hosting a été accordé. La référence du secret est dans `apphosting.staging.yaml`.
- [x] Le workflow Functions écrit temporairement `.env.assodarts-staging` à partir de la variable non secrète `WEB_REVALIDATION_URL`; ce fichier n'est pas commité. Les triggers l'utilisent après projection et lient `WEB_REVALIDATION_SECRET`.
- [ ] Après le rollout, vérifier que les triggers Functions peuvent lire le secret et qu'un événement source invalide ses caches via `/api/revalidate` (attendu HTTP 200).
- [ ] Après le premier rollout staging, vérifier que les triggers Functions ont accès au secret et qu'un événement source invalide ses caches via `/api/revalidate` (attendu HTTP 200).
- [ ] Pour la production, enregistrer une app Web dans `assodarts`, puis configurer ses propres valeurs `NEXT_PUBLIC_FIREBASE_*` dans `apphosting.production.yaml`. Ne pas réutiliser les valeurs staging.
- [ ] Avant une phase nécessitant des secrets, les créer dans Secret Manager, accorder l'accès au compte du backend et ajouter uniquement des références dans `apphosting.yaml`. Aucun secret n'est requis par le squelette phase 1 ; ne pas créer de fausse référence bloquante.

## Déclenchement

Sur un push `release-*`, le job `Deploy web to App Hosting (staging)` attend les contrôles existants puis crée un rollout pour `GITHUB_SHA`. Si le backend ou ses variables manquent, il échoue avec un message explicite. L'absence d'un échec ne constitue pas une preuve de disponibilité du site : contrôler le rollout, les logs Cloud Build, le domaine et les routes.

La production utilise le workflow manuel `Deploy web production`, limité à `main`, protégé par l'environnement GitHub `production` et par le succès du workflow Quality sur le SHA exact. Le propriétaire déclenche et approuve ; aucun lancement production n'a été effectué dans cette phase.

Pour inspecter sans déployer :

```sh
firebase apphosting:backends:list --project assodarts-staging
firebase apphosting:rollouts:create --help
```

La commande de rollout utilisée par les workflows est `firebase apphosting:rollouts:create BACKEND_ID --project PROJECT_ID --git-commit COMMIT_SHA --force --non-interactive`. Ne pas l'exécuter à la main pour contourner les contrôles ou l'approbation. Vérifier en particulier la réussite du build App Hosting et le contrat de résolution d'hôtes derrière le proxy.

## Émulateur App Hosting en local

Avec Node 26, Java 21 et Firebase CLI 15.35.0, arrêter d’abord `./web/dev`, puis depuis `backend/` exécuter :

```sh
firebase emulators:exec --project demo-assodarts-rules --only apphosting,firestore 'curl -fsS http://localhost:5002/'
```

La configuration `backend/firebase.json` pointe vers `../web` et `web/apphosting.emulator.yaml` fixe `ROOT_DOMAIN=localhost` et le projet de démonstration. La commande vérifie localement le service sans déployer. Redémarrer ensuite le serveur habituel avec `./web/dev start`.

## Contrôle des domaines personnalisés en local

Avec Java 21, Firebase CLI 15.35.0 et les dépendances web installées, depuis `backend/` :

```sh
firebase emulators:exec --project demo-assodarts-rules --only firestore 'npm --prefix ../web run test:domain'
```

Le test crée puis supprime dans l'émulateur `domains/club.example` contenant un `clubId` UUID. Il vérifie les pages publiées du domaine custom (profil, agenda, événement, robots et sitemap) ainsi que les réponses 404 pour un domaine inconnu ou un club non publié. Il ne crée rien dans Firebase réel.

### Vérifier les premières pages publiques de phase 2

Les pages réelles nécessitent Firestore et des projections publiées ; le placeholder d'un slug arbitraire n'est plus une preuve de fonctionnement. Depuis `backend/`, avec Java 21, Node 24 et Firebase CLI installés :

```sh
npm --prefix functions run build
firebase emulators:exec --project demo-assodarts-rules --only firestore,storage 'npm --prefix functions run test:rules && cd functions && node scripts/test-public-emulator.cjs'
```

Pour le test HTTP, construire d'abord le web avec Node 26 (`cd web && npm ci && npm run build`), arrêter `./web/dev` si le port 3000 est occupé, puis depuis `backend/` :

```sh
firebase emulators:exec --project demo-assodarts-rules --only firestore 'cd ../web && node scripts/test-public-pages.mjs'
```

Ce test nécessite Node 26 sur le PATH, crée des données uniquement dans l'émulateur et démarre temporairement le serveur Next sur le port 3000. Redémarrer ensuite `./web/dev start`. Le script `backend/functions/scripts/backfill-public.cjs` refuse de s'exécuter sans `FIRESTORE_EMULATOR_HOST`; `backfill-club-slugs.cjs` est limité aux projets `demo-*` et démarre en dry-run. Aucun des deux ne doit servir directement à une migration production. Les limites connues sont dans [RAPPORT-PHASE-2.md](RAPPORT-PHASE-2.md).

## Démonstration locale des rôles et pages

Avec Node 26 (installé via nvm), Java 21 et les dépendances web installées (`cd web && npm ci`), depuis la racine du dépôt :

```sh
./web/demo start    # démarre Auth et Firestore, installe profils/données fictifs, relance le web
./web/demo status   # état du web et des émulateurs
./web/demo restart  # redémarre les deux et réinitialise les données de démonstration
./web/demo stop     # arrête les deux processus gérés
```

Si Java 21 n'est pas sur le PATH, indiquez son installation avec `JAVA_HOME=/chemin/vers/jdk-21 ./web/demo start`. La première utilisation peut télécharger Firebase CLI 15.35.0 et les émulateurs Auth/Firestore. Les ports 8080 et 9099 doivent être libres ; le script refuse de tuer un processus inconnu. Les données et comptes sont dans le projet isolé `demo-assodarts-web`, jamais dans un projet Firebase réel; les données sont éphémères.

- Vitrine : http://localhost:3000/
- Club fictif : http://localhost:3000/?club=club-a
- Agenda : http://localhost:3000/agenda?club=club-a
- Détail d'événement : http://localhost:3000/e/tournoi-decouverte?club=club-a
- Espace responsables : http://admin.localhost:3000/ (comptes de test listés dans `web/README.md`)

Le sous-domaine `club-a.localhost:3000` fonctionne aussi si votre navigateur résout les sous-domaines `.localhost`. Les formulaires d'inscription et la gestion du club restent à développer dans les phases suivantes ; la page résultats n'est pas créée. Ne pas utiliser `./web/dev restart` pour relancer une démonstration : cette commande seule ne garantit pas que le serveur utilise l'émulateur ; utiliser `./web/demo restart`.
