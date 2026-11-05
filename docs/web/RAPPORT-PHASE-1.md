# Rapport de phase 1 — en cours, non validée

## État actuel — 5 novembre 2026

Les vérifications locales de routage, build staging simulé et qualité sont désormais documentées ci-dessous; la phase reste **non clôturée** tant que la PR/CI complète, le premier rollout staging, DNS/domaines Auth et le smoke test en ligne ne sont pas prouvés. Voir l'addendum de clôture à la fin de ce rapport et [SUIVI.md](SUIVI.md).

Les sections 1 à 7 ci-dessous constituent un instantané historique de la phase 1 ; les éléments réalisés depuis, notamment les slugs et le backend staging, sont précisés dans l’actualisation à la fin et dans le suivi courant. Ce rapport ne déclare pas la phase terminée. La checklist et les contraintes détaillées restent dans [SUIVI.md](SUIVI.md), le déploiement dans [DEPLOY.md](DEPLOY.md).

## 1. Réalisations

- Documentation : plan des pages dans `PLAN-PAGES.md`, procédure App Hosting dans `DEPLOY.md`.
- CI : URLs npm publiques pour `shared/package-lock.json` ; alignement des actions CodeQL init/analyze sur v4.38.1 ; override ciblé gRPC web à 1.14.7 pour corriger les avis élevés existants ; jobs App Hosting staging et production manuelle définis.
- Web : thème proche d'iOS, composants de base shadcn/Tailwind, messages centralisés, pages provisoires, routeur pur `resolveHost`/`resolveRequest`, schéma de slug partagé consommé par le web, paramètre local `?club=` et résolution serveur des domaines personnalisés dans `domains/{host}`.
- Règles et Functions métier : aucune règle, collection ou Function métier modifiée pour cette phase.

## 2. Vérifications

- Functions : build et 227 tests Jest réussis ; les tests de règles Firestore/Storage ont réussi sur émulateur dans le run GitHub du commit `59b56ba`.
- Package partagé : installation propre, 46 tests Vitest réussis et audit npm sans vulnérabilité au niveau demandé.
- Web : installation propre `npm ci` depuis une archive Git sans dépendances préexistantes, 14 tests Vitest et build Next réussis ; lint et typage réussis dans l’espace de travail ; `npm audit --audit-level=high` réussit avec 8 alertes modérées restantes. L’override gRPC 1.14.7 est à suivre.
- HTTP local : vitrine, sous-domaine club et admin HTTP 200 ; URL canonique HTTP 301 ; `?club=test-club` HTTP 200 ; slug réservé HTTP 404 avec message club. L’existence des clubs valides n’est pas encore vérifiée. Sur émulateur Firestore, domaine connu HTTP 200 et domaine inconnu HTTP 404 (`npm run test:domain` via `firebase emulators:exec`).
- App Hosting et Firestore Emulator Suite : démarrage sur le projet `demo-assodarts-rules`, vitrine HTTP 200 ; configuration locale dans `backend/firebase.json` et `web/apphosting.emulator.yaml`.
- CI GitHub : sur le commit `fbde3f5`, les jobs web, shared, Functions, règles et secret-scan ont réussi ; iOS était encore en cours au contrôle. La CI du commit final reste à contrôler. Aucun déploiement staging réussi n’a été observé.

## 3. Écarts et traitement

- `events` et `clubs` sont privés ; phase 1 ne lit aucune donnée métier pour remplir les placeholders.
- Le modèle existant ne contient ni registre de slugs ni schéma de domaine. La phase 1 interdit de créer `club_slugs` ou une Function métier. Une structure minimale serveur `domains/{host}: {clubId: UUID}` est utilisée pour la résolution des domaines ; elle ne crée aucune donnée en production et doit être intégrée aux projections phase 2. La résolution slug → clubId et le 404 d’un club valide mais inconnu attendent `club_slugs`.
- `shared/` est consommé par le web via une dépendance locale empaquetée ; son intégration à l'archive déployable des Functions reste à démontrer avant usage par celles-ci. App Hosting avec dépendance hors de `web/` doit être validé dans Cloud Build.
- Le CLI Firebase disponible n'accepte pas encore Node 26 pour les Functions ; Node 24 y est conservé. Le runtime web Node 26 et la version Next sur App Hosting doivent être vérifiés en staging.
- Next.js signale que `middleware.ts` est déprécié au profit de `proxy.ts`. Le cahier des charges demande explicitement `middleware.ts` ; conserver provisoirement cette convention et planifier la migration avec tests de routage.

## 4. Décisions produit

Aucune nouvelle décision produit n'a été tranchée. Les placeholders n'impliquent pas de données ou de fonctionnalités métier. La durée de conservation des alias et les autres valeurs de phases ultérieures restent en attente dans `SUIVI.md`.

## 5. Actions manuelles

- [x] Créer et lier le backend App Hosting staging, choisir région/runtime et environnement `staging`, désactiver les rollouts automatiques (fait après l’instantané initial).
- [ ] Configurer `APPHOSTING_BACKEND_ID`, les droits App Hosting, les domaines et DNS, puis exécuter le circuit CI sur une branche `release-*` après validation.
- [ ] Confirmer que Cloud Build inclut `shared/`, que le runtime accepte les versions choisies et que le rollout et les domaines fonctionnent.
- [ ] Suivre la checklist complète de `DEPLOY.md` ; aucune action de production sans validation du propriétaire.

## 6. Consolidation et séparation

Les slugs sont définis une seule fois dans `shared/` et consommés côté web ; Functions et schémas partagés restent séparés tant que le packaging Firebase n'est pas prouvé. Les pages publiques et privées restent séparées par hôte ; les données privées ne sont pas publiées. Aucun système de permissions supplémentaire n'a été ajouté.

## 7. Risques et dette

À la date de l’audit initial : CI finale et staging non prouvés ; backend App Hosting alors absent ; confiance des en-têtes de proxy à vérifier ; gestion et publication futures des domaines personnalisés à définir ; résolution de clubs et 404 réels en attente de la phase 2 ; validation de l'override gRPC à suivre ; Node/Next récents potentiellement en aperçu chez App Hosting ; migration OIDC et alertes de sécurité historiques encore ouvertes.

## Actualisation — vérifications phase 1 (5 novembre 2026)

### Vérifié en local

- Suite web : lint, typecheck, 24 tests Vitest, audit `npm audit --audit-level=high` (8 alertes modérées) et build de production réussis.
- Schémas partagés : 46 tests; Cloud Functions : lint, build et 227 tests réussis après synchronisation de la copie `club-slug.ts`.
- Workflow : `quality.yml` parse; le run push de `4bd47b2` est vert pour les jobs exécutés (iOS sauté car la PR vérifie le même SHA). Sur le run PR, SonarCloud, Web, Functions, règles, schémas et secret scan passent; iOS est encore en cours au dernier contrôle. Le nouveau run PR doit terminer avant de clôturer la gate.
- Routage local : vitrine, club et admin répondent HTTP 200; `/c/club-a/agenda` redirige HTTP 301 vers `club-a.localhost`; test domaine connu 200/inconnu 404 réussi sur émulateur (`npm run test:domain`).
- Build de staging simulé : `ROOT_DOMAIN=staging.assodarts.app` génère bien `noindex, nofollow`.
- Auth Emulator + Firestore Emulator locaux : membre, bureau, admin club et développeur plateforme se connectent; identifiants fictifs décrits dans `web/README.md`. Les comptes restent dans `demo-assodarts-web`.

### Restant avant clôture

- La PR `develop → release-v0.1` et le merge relèvent du propriétaire. La phase ne sera pas marquée terminée tant que le run Quality du SHA courant n'est pas entièrement vert.
- Le déploiement App Hosting staging n'a pas été effectué : il exige un push release après la gate. Le backend et la configuration Firebase Web publique existent, mais le build Cloud (dont l'inclusion de `shared/`) et le premier smoke test en ligne ne sont pas prouvés.
- Domaine/certificat staging, DNS, en-têtes réellement reçus derrière App Hosting et domaines autorisés Auth doivent être vérifiés dans la console Firebase.
- Lighthouse et audit d'accessibilité, validation du comportement `noindex` sur l'URL staging et migration `middleware` → `proxy` restent ouverts. La phase 2 conserve également ses éléments ouverts dans `RAPPORT-PHASE-2.md`.
- Aucun déploiement production n'a été lancé; une action ou approbation manuelle reste sous le contrôle du propriétaire.

### Backend staging

Le backend `assodarts-web-staging` existe dans `assodarts-staging` (`europe-west4`), est relié au dépôt et utilise Node 24 avec les rollouts automatiques désactivés. Les variables GitHub et la configuration Firebase Web publique de staging sont présentes. Le premier rollout reste à faire après merge de la PR et push sur `release-v0.1`; voir [DEPLOY.md](DEPLOY.md).
