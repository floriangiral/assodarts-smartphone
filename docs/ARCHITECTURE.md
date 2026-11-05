# Architecture et invariants

État du code consulté sur `develop` au 5 novembre 2026 ; les cibles web sont séparées des fonctionnalités existantes dans [web/SUIVI.md](web/SUIVI.md).

## État actuel

```text
iOS SwiftUI ── Firebase Auth / Firestore / Storage ── Firebase
       │                                                │
       └────────────── callable Functions ──────────────┤
                                                        ├── Stripe
                                                        ├── Resend
                                                        └── FCM

shared/ : validation de slugs isolée, encore non consommée
web/    : squelette versionné, sans données réelles ; gestionnaire local dans web/dev
```

Les documents sources et leurs règles sont dans `backend/firestore.rules`, `backend/storage.rules` et `backend/types.ts`. Ce dernier est une description TypeScript manuelle, pas une preuve que chaque lecture ou écriture est validée à l'exécution. Les modèles iOS et leurs conversions sont dans `ios-assodarts/Assodarts/Services/Firebase/RemoteModels.swift`.

## Identité, appartenance et permissions

- Les nouveaux clubs sont identifiés par un UUID : `backend/functions/src/createClub.ts` utilise `randomUUID()`. Un futur slug est un champ séparé et ne remplace pas cet ID.
- Les documents `members/{memberId}` ont un ID applicatif UUID. L'UID Firebase Auth se trouve dans `authUid` ; il ne doit jamais être comparé à `memberId`. Les clients retrouvent le profil via `authUid`.
- `members.clubId` représente le premier club et reste figé une fois défini ; `defaultClubId` est la préférence de navigation. Il ne faut pas leur donner une nouvelle signification.
- `memberships/{clubId}_{authUid}` contient l'appartenance et les rôles `admin`, `board` ou `member`, avec un statut. Les règles utilisent cet index pour les autorisations par club. `backend/functions/src/shared/auth.ts` fournit des helpers pour certaines Functions ; d'autres vérifications sont encore répétées.
- Les administrateurs de plateforme sont référencés dans `platform_admins/{uid}` ; aucune écriture client n'est autorisée. Ne pas créer un second système de rôles pour le web.
- La visibilité des profils reste limitée par les champs historiques `clubId` et `defaultClubId` : son comportement pour N clubs doit être analysé avant toute modification de règles.

## Événements et inscriptions existants

Les événements sont dans `events/{eventId}` ; les réponses membres sont dans `event_registrations/{eventId}_{memberId}`. L'app iOS lit et écrit directement ces réponses, comme les règles l'autorisent. Le cahier des charges des inscriptions publiques demande des écritures uniquement serveur : les deux exigences nécessitent une migration ou une coexistence explicitement décidée et testée. Ne pas fermer les écritures existantes sans préserver iOS.

Les tournois et leurs entrées existent ; l'aptitude des résultats à une publication publique reste à auditer. Aucun champ privé ne doit être publié simplement parce que le serveur Admin SDK peut le lire : celui-ci contourne les règles Firestore et requiert aussi des autorisations IAM adaptées.

## Intégrations et sécurité

- Stripe Connect et les abonnements sont traités par les Functions et webhooks existants. Toute migration d'API Stripe doit préserver les flux de paiement et être testée.
- `backend/functions/src/triggers/sendMailOnCreate.ts` envoie via Resend à partir de `mail/{docId}`. Une future outbox doit réutiliser cette intégration et garantir l'idempotence ; elle n'existe pas encore.
- Les tests de règles sur émulateur existent dans `backend/functions/rules-tests/`, mais ne couvrent pas encore tous les flux. Toute modification des règles impose des cas autorisés et refusés sur émulateur.
- La CI actuelle utilise encore des clés de comptes de service pour le déploiement Firebase ; la migration OIDC et la réduction des rôles IAM sont ouvertes.

## Améliorations d'architecture envisagées

1. Réconcilier les contrats TypeScript, Swift et les règles avec des tests de compatibilité avant de multiplier les consommateurs.
2. Rendre le package partagé consommable par Next.js et par l'archive déployée des Functions : le code source ESM exporté par `shared/` n'est pas encore une intégration vérifiée au build CommonJS des Functions.
3. Découper progressivement `RemoteRepository.swift` et `AppStore+Backend.swift` par domaine, sans changer les comportements publics, avec tests ciblés.
4. Consolider les helpers d'autorisation seulement lorsque leurs règles sont effectivement identiques ; ne pas réduire les différences de privilèges.
5. Traiter le journal `backend/firebase-debug.log` suivi par Git : évaluer son contenu et l'historique avant retrait et exclusion. Ne pas publier de données personnelles ou d'identifiants sensibles.
