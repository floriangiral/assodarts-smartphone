# Firebase App Hosting — préparation et déploiement

État du 5 novembre 2026. Aucun backend App Hosting staging n'était présent lors de la vérification CLI (`apphosting:backends:list` sur `assodarts-staging` a retourné une liste vide). Ce document est une préparation ; il ne constitue pas une preuve de déploiement. **Ne pas déployer en production sans décision et validation du propriétaire.**

## Préparer les backends

- [ ] Vérifier la facturation et les API requises sur chaque projet, les permissions IAM et les limites de coût.
- [ ] Dans Firebase Console, créer un backend App Hosting pour `assodarts-staging`, lier `floriangiral/assodarts-smartphone`, sélectionner `web/` comme racine d'application et l'environnement App Hosting `staging` pour charger `apphosting.staging.yaml`.
- [ ] Sélectionner un runtime compatible avec `web/package.json` (Node 26) ; vérifier sa disponibilité et le support de Next.js/monorepo dans App Hosting. Le web dépend de `file:../shared` ; valider que `shared/` est présent à l'installation/build GitHub App Hosting. En cas d'échec, corriger le packaging avant tout déploiement.
- [ ] Désactiver les rollouts automatiques App Hosting : GitHub Actions doit déclencher uniquement le commit dont les contrôles ont réussi. Ne pas démarrer un premier rollout avant vérification de la configuration.
- [ ] Dans l'environnement GitHub `staging`, définir `FIREBASE_PROJECT_ID=assodarts-staging`, `APPHOSTING_BACKEND_ID` avec l'ID réel, et vérifier que `FIREBASE_SERVICE_ACCOUNT` et ses droits permettent App Hosting. La migration vers OIDC reste ouverte.
- [ ] Une fois staging validé, préparer séparément un backend de production dans `assodarts`, environnement GitHub `production` avec `FIREBASE_PROJECT_ID=assodarts` et son propre `APPHOSTING_BACKEND_ID`. Ne créer les ressources ni ne déployer la production sans validation du propriétaire.

La création assistée est disponible avec `firebase apphosting:backends:create --project assodarts-staging` ; les choix de région, de connexion GitHub et de ressources doivent être confirmés dans la console ou l'assistant. La racine de l'application est `web/`. Les [instructions Firebase de monorepo](https://firebase.google.com/docs/app-hosting/monorepos) et de [rollout](https://firebase.google.com/docs/app-hosting/rollouts) précisent les paramètres.

## Domaines et Auth

- [ ] Staging : `staging.assodarts.app`, `admin.staging.assodarts.app`, `*.staging.assodarts.app`.
- [ ] Production : `assodarts.app`, `www.assodarts.app`, `admin.assodarts.app`, `*.assodarts.app`.
- [ ] Suivre la validation et les enregistrements DNS affichés par Firebase pour chaque backend et attendre les certificats. Préserver les enregistrements explicites, notamment DKIM/SPF Resend : ne pas les supprimer au profit du générique.
- [ ] Firebase Auth : autoriser uniquement les hôtes admin concernés et `localhost` pour le web. Les sous-domaines de club n'ont pas besoin d'Auth.
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

Le test crée puis supprime dans l'émulateur `domains/club.example` contenant un `clubId` UUID. Un domaine présent renvoie le placeholder, un domaine absent renvoie 404. Il ne crée rien dans Firebase réel. Le cycle de vie de ces correspondances et le lien avec les pages publiées restent à définir en phase 2.

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

Ce test nécessite Node 26 sur le PATH, crée des données uniquement dans l'émulateur et démarre temporairement le serveur Next sur le port 3000. Redémarrer ensuite `./web/dev start`. Le script `backend/functions/scripts/backfill-public.cjs` refuse de s'exécuter sans `FIRESTORE_EMULATOR_HOST` ; ne pas l'utiliser pour une migration de production. Les limites connues sont dans [RAPPORT-PHASE-2.md](RAPPORT-PHASE-2.md).
