# Audit initial du chantier web

État constaté sur `develop` au commit `16e160e`. Ce document est un état des lieux, pas un rapport de phase terminée.

## Dépôt et modèle

- Les Functions sont un package npm autonome, Node 22 (`backend/functions/package.json` et `package-lock.json`). La configuration Firebase est dans `backend/firebase.json`, avec les alias staging `assodarts-staging` et production `assodarts` dans `backend/.firebaserc`. Elle ne définit pas encore les émulateurs.
- `backend/types.ts` décrit les collections racine `clubs`, `members`, `memberships`, `events`, `event_registrations`, `tournaments` et `tournament_entries`. Les équivalents iOS se trouvent dans `ios-assodarts/Assodarts/Services/Firebase/RemoteModels.swift`, `Models/Club.swift`, `Models/Member.swift`, `Models/ClubEvent.swift` et `Models/Role.swift`.
- `backend/functions/src/createClub.ts` génère l'ID du club avec `randomUUID`, retrouve le membre par `authUid`, crée une adhésion et préserve le premier `clubId`. `backend/types.ts` distingue l'ID UUID du membre et son `authUid`.
- `memberships/{clubId}_{authUid}` contient `clubId`, `memberId`, `authUid`, `status` et `role` (`admin`, `board`, `member`). `backend/firestore.rules`, fonctions `membership`, `isActiveMember` et `isBoard`, utilisent déjà cet index pour les autorisations par club. `platform_admins/{uid}` est non écrivable par les clients. La visibilité des profils membres dépend toutefois encore de `clubId` et `defaultClubId` (fonction `canViewMemberProfile`).
- Les événements existants sont dans `events/{eventId}` : `clubId`, `title`, `description`, `startsAt`, `location`, `category`, `createdByMemberId`. Les catégories iOS sont dans `Models/ClubEvent.swift`. Les résultats de tournois sont représentés par `tournaments` et `tournament_entries` ; leur adéquation à une publication publique reste à analyser.
- Les règles sont `backend/firestore.rules` et `backend/storage.rules`. `backend/functions/src/firestoreRules.test.ts` vérifie du texte de règles, pas des autorisations dans l'émulateur. Toute modification exigera donc une nouvelle suite d'intégration avec l'émulateur.
- Le déclencheur Resend existant est `backend/functions/src/triggers/sendMailOnCreate.ts`, sur `mail/{docId}`, avec `RESEND_API_KEY` et `DEFAULT_FROM_EMAIL` en secrets. L'outbox demandée devra réutiliser l'envoi sans envoyer deux fois les mêmes messages.

## Écarts à traiter

1. `backend/firestore.rules` autorise actuellement les clients à créer, modifier et supprimer leurs réponses dans `event_registrations`; `RemoteRepository.swift` écrit directement dans cette collection. Les IDs sont `eventId_memberId`. Interdire toutes ces écritures sans migration casserait iOS. Option proposée : conserver ces réponses existantes et créer une collection d'inscriptions publiques distincte, uniquement serveur, avec une projection agrégée tenant compte des deux modèles ; ou migrer d'abord iOS vers des callables avant de fermer les règles. Le choix reste à valider à la phase 3.
2. Les règles d'accès au contenu de club utilisent déjà l'index multi-club `memberships` ; remplacer celui-ci par un second index de rôles serait redondant. Recommandation pour la phase 4 : le réutiliser, puis traiter séparément la visibilité limitée des profils avec des tests d'émulateur et une vérification de compatibilité iOS.
3. Les tests actuels des règles ne prouvent pas les accès effectifs ; prévoir Firebase Local Emulator Suite et des cas autorisés/refusés avant toute modification de règles.

## Schémas partagés et déploiement

`shared/` contient une première validation de slug indépendante. Il n'est pas encore intégré aux Functions ni à un workspace : leur déploiement Firebase utilise `backend/functions` comme racine de source. Un lien npm local vers un répertoire parent ne suffit pas à garantir sa présence dans l'archive déployée. Avant consommation par les Functions, préparer un package compilé et inclus explicitement dans la source déployable, puis vérifier build et déploiement à l'émulateur ; conserver un seul code source et éviter toute copie manuelle divergente.

App Hosting prend en charge les domaines génériques ([Firebase](https://firebase.blog/posts/2025/04/apphosting-general-availability/)) et les rollouts manuels ciblant un commit ([documentation Firebase](https://firebase.google.com/docs/app-hosting/rollouts)). Désactiver les rollouts automatiques des backends et faire déclencher par CI le commit testé évite les conflits avec le pipeline. `.github/workflows/quality.yml` déploie actuellement le backend staging sur les pushes `release-*` ou à la demande, après les contrôles ; `.github/workflows/deploy-firebase.yml` propose aussi un déploiement manuel dans l'environnement choisi. Aucun workflow App Hosting n'existe encore.

## Vérification initiale

- Functions : `npm run build` réussi ; `npm test -- --runInBand` : 23 suites, 227 tests réussis.
- Schéma partagé : `npm test --prefix shared` : 46 tests réussis.
- Aucune règle ni Function existante n'a été modifiée. L'app, le site, la CI distante, les émulateurs et le déploiement staging n'ont pas encore été validés.
