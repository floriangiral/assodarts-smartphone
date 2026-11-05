# Assodarts

Assodarts comprend une application iOS SwiftUI, un backend Firebase et un site Next.js multi-club. Les pages publiques sont disponibles en local; le portail responsable utilise Firebase Auth et les rôles existants, mais la phase 4 reste partielle. Aucun rollout web staging ni déploiement production n'a été validé. L'état et les preuves figurent dans [docs/SUIVI-CHANTIERS.md](docs/SUIVI-CHANTIERS.md).

## Où trouver quoi

| Zone | Contenu |
| --- | --- |
| `ios-assodarts/` | Application SwiftUI, modèles, interface, intégration Firebase et tests Xcode. |
| `backend/` | Configuration Firebase, règles Firestore et Storage, index, scripts et description manuelle des documents dans `types.ts`. |
| `backend/functions/` | Cloud Functions Node/TypeScript, intégrations Stripe, Resend et FCM, tests Jest et tests des règles sur émulateur. |
| `shared/` | Validation Zod des slugs et tests Vitest ; utilisée par le web et copiée dans les Functions avec vérification de synchronisation. |
| `web/` | Vitrine, pages publiques et portail responsable à cinq onglets; commandes et profils locaux dans `web/README.md`. |
| `.github/` | Workflows GitHub Actions, Dependabot et politique de sécurité. |
| `docs/` | Suivi des chantiers, architecture, sécurité et cahier des charges web. |

La configuration Firebase `backend/.firebaserc` associe `staging` à `assodarts-staging` et `production` à `assodarts`. La production ne doit être déployée qu'après validation explicite du propriétaire.

## Démarrage

- [Configuration et exécution locales](SETUP.md) : prérequis iOS, Functions, tests des règles et démo web avec profils Auth.
- [Architecture et invariants](docs/ARCHITECTURE.md) : collections, identifiants, rôles et frontières de confiance.
- [Suivi des chantiers](docs/SUIVI-CHANTIERS.md) : ordre de travail, risques et preuves disponibles.
- [Projet web](docs/web/SUIVI.md) : état des cinq phases, décisions et actions manuelles.
- [Cahier des charges web initial](docs/web/CAHIER-DES-CHARGES.md) : demande complète, conservée comme référence.
- [Sécurité et CI](docs/web/SECURITE-CI.md) et [politique de signalement](.github/SECURITY.md).

## Règles de contribution et de livraison

Le travail demandé s'effectue directement sur `develop`, par commits atomiques. Une PR vers `release-*` est utilisée pour la revue ; ne pas rebase ni faire de push forcé sur une branche partagée. Le propriétaire conserve la décision de merge et tout déploiement en production. Les branches protégées et la CI ne remplacent pas la revue humaine.

Chaque phase web doit commencer par un audit ciblé et se conclure par `docs/web/RAPPORT-PHASE-N.md` avec les changements, les résultats vérifiés, les écarts, les décisions, les actions manuelles, les consolidations et les risques. **Aucune phase n'est actuellement terminée.**

Les identifiants Firebase clients sont publics ; les clés Resend, SMS, Stripe, les jetons et les clés de comptes de service sont des secrets. Ne jamais ajouter de secret, de donnée personnelle ou de journal de production dans le dépôt.
