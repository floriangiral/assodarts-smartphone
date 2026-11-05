# Suivi du site web multi-club

Dernière vérification : **5 novembre 2026**, `develop` au commit `207dd93` avant cette mise à jour documentaire. Référence des exigences : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md). Plan des pages : [PLAN-PAGES.md](PLAN-PAGES.md). État global et sécurité : [SUIVI-CHANTIERS.md](../SUIVI-CHANTIERS.md).

**Aucune phase n'est terminée.** Les cases non cochées incluent les tâches qui n'ont pas été réalisées ou dont la preuve manque. Les valeurs par défaut effectivement appliquées et celles encore en attente sont précisées dans les rapports de phase.

## Principes transverses

- [ ] Avant chaque phase, auditer les modèles, rôles, règles, Functions et CI concernés ; citer les fichiers et traiter les contradictions sans les masquer.
- [ ] Respecter les identifiants UUID de club et de membre, distinguer `memberId` et `authUid`, conserver la sémantique de `clubId` et `defaultClubId`, et réutiliser `memberships` et `platform_admins`.
- [ ] Utiliser App Router Next.js, TypeScript strict, Tailwind/shadcn, Firebase Admin serveur pour le public et SDK navigateur pour l'admin, messages français centralisés, Zod partagé, Vitest, Playwright et Local Emulator Suite.
- [ ] Garder les secrets dans Secret Manager ; les clés Firebase des clients sont des identifiants publics. Aucun secret ne doit figurer dans le dépôt ou en clair dans `apphosting.yaml`.
- [ ] Fournir les preuves de tests, builds, émulateurs et déploiements pertinentes ; toute modification de règles exige des tests de refus et d'autorisation.
- [ ] Produire pour chaque phase `RAPPORT-PHASE-N.md` avec les sept rubriques demandées dans le cahier des charges. Les rapports des phases 1 et 2 existent et décrivent des phases en cours, sans les déclarer terminées.
- [ ] Commits atomiques sur `develop`, PR `develop → release-*`, sans rebase ni force-push sur les branches partagées. Le propriétaire garde les merges et la production.

## Phase 1 — socle, hôtes et staging

**État : partiel, non terminé.** Voir [RAPPORT-PHASE-1.md](RAPPORT-PHASE-1.md) pour les preuves historiques et leur actualisation.

- [x] Audit initial, squelette Next.js, routage d'hôtes, schéma de slug, configuration Firebase, commandes locales, premiers tests et rapport documentés.
- [x] Backend App Hosting `assodarts-web-staging` créé dans `europe-west4`, dépôt lié, environnement `staging`, Node 24 et rollouts automatiques désactivés ; variables GitHub staging configurées.
- [x] Résolution des slugs et intégration du schéma aux Functions réalisées depuis, en phase 2 ; le web dispose d'un mode local de secours et d'une démonstration avec émulateur.
- [ ] Vérifier la CI complète sur le commit final, notamment SonarQube et les contrôles iOS applicables. Les derniers runs observés sur `caf0965` étaient en échec ; un run push sur `207dd93` a échoué au job SonarQube.
- [ ] Valider le premier rollout staging par la CI sur la branche release, les permissions de l'identité de déploiement et la présence de `shared/` au build Cloud. Le backend existe, mais aucun site staging déployé n'a été prouvé.
- [ ] Configurer et vérifier domaines, certificats, en-têtes de proxy et domaines autorisés Auth ; raccorder les domaines personnalisés aux pages publiques.
- [ ] Vérifier l'accessibilité et le mode sombre, compléter l'internationalisation et les tests de parcours ; suivre l'override gRPC et la migration `middleware` vers `proxy`.

## Phase 2 — pages publiques et projections

**État : en cours.** Voir [RAPPORT-PHASE-2.md](RAPPORT-PHASE-2.md) pour les preuves et les écarts.

- [x] Audit des événements et des résultats : les résultats nominatifs ne sont pas publiés, aucune page résultats n'a été créée.
- [x] Projections `clubs_public` et `events_public`, triggers, backfill limité à l'émulateur et tests de règles. La visibilité absente vaut `members` ; la publication du club est explicite.
- [x] Registre de slugs, callable avec contrôle des rôles et unicité transactionnelle, proposition à la création du club et alias conservés indéfiniment par défaut. Concurrence, refus et alias vérifiés sur émulateur ; la redirection serveur est actuellement 308, au lieu du 301 demandé.
- [x] Pages club, agenda et événement ; vitrine provisoire, canonicals, sitemap, robots, image Open Graph et JSON-LD. Tests HTTP locaux et démonstration fictive disponibles.
- [ ] Migrer les clubs existants et préparer un backfill réel sûr ; compléter les tests de création de club et des triggers émulés.
- [ ] Résoudre l'écart 308/301, intégrer les domaines personnalisés et ajouter la revalidation à la demande ; le cache de résolution est actuellement de 60 secondes.
- [ ] Finaliser les contenus et messages, les formats des données publiques et un contact commercial vérifié.
- [ ] Tester accessibilité, mobile et Lighthouse ; confirmer `noindex` et fonctionnalités sur le premier rollout staging.

## Phase 3 — inscriptions publiques et mails

**État : non commencée. Point de conception ouvert.** Les réponses membres `event_registrations` existent et sont modifiables directement par iOS. Le cahier des charges demande des inscriptions publiques exclusivement serveur. Deux options à analyser : étendre/migrer le modèle et iOS vers des callables, ou maintenir une structure publique distincte avec agrégats cohérents. Aucune option n'a été choisie ni implémentée. Références : `backend/firestore.rules`, `backend/types.ts`, `RemoteRepository.swift`.

- [ ] Auditer l'inscription existante et le déclencheur Resend `mail/{docId}` ; justifier le modèle retenu et préserver les parcours iOS.
- [ ] Concevoir configuration d'inscription, champs, capacités globales/par catégorie, liste d'attente, périodes, prix informatif et projections sans données personnelles.
- [ ] Mettre en œuvre validation Zod, App Check web, honeypot et limitation de débit ; protéger les callables ; tester la prise en charge des sous-domaines et le mode debug local.
- [ ] Implémenter inscription idempotente et contrôle de capacité en transaction, jeton de désinscription stocké uniquement sous forme de hash, annulation et promotion transactionnelles, prévention des doublons et traitement des courses.
- [ ] Construire une outbox serveur email/SMS, avec idempotence, états, relances et adaptation de l'intégration Resend existante ; modèles FR HTML et texte, liens événement/annulation.
- [ ] Créer le formulaire mobile et la page d'annulation, consentements non précochés et versionnés, états de résultat et actualisation des places. Vérifier la politique de confidentialité existante sans la réécrire seul.
- [ ] Décisions à valider : contact requis **au moins email ou téléphone** ; liste d'attente activée ; aucun rattachement automatique à un membre par email ; liste publique des inscrits désactivée ; conservation **12 mois** avec purge ou anonymisation. Rien de cela n'est encore appliqué.
- [ ] Tests Jest de capacité, attente, promotion, doublon, fenêtre, visibilité, jetons et concurrence ; tests de règles ; Playwright sur émulateur inscription → outbox → annulation → promotion ; rédiger `RAPPORT-PHASE-3.md`.

## Phase 4 — espace responsables

**État : non commencée.** Recommandation initiale : réutiliser les documents `memberships/{clubId}_{authUid}` existants plutôt qu'ajouter un second index de rôles. L'accès aux profils via les champs historiques reste à examiner. Si une solution modifie les règles utilisées par iOS et n'est pas rétrocompatible, la soumettre avant implémentation.

- [ ] Auditer les fournisseurs Firebase Auth réellement utilisés par iOS et les permissions multiclub. Implémenter connexion navigateur sans cookies de session ni rendu serveur authentifié dans cette phase.
- [ ] Retrouver les membres via `authUid`, puis les adhésions responsables ; sélecteur multiclub, mémorisation locale non critique, écran sans accès et vérifications serveur/règles.
- [ ] Réaliser tableau de bord, gestion des événements et de leurs inscriptions, aperçu public, QR code PNG/PDF, lien copiable, suivi et export CSV Excel FR.
- [ ] Éditer et publier le profil du club via la source et sa projection, gérer logo/couverture Storage et changement de slug via callable ; notifier les inscrits via l'outbox si l'annulation est choisie.
- [ ] Garantir que les documents créés restent lisibles par iOS ; documenter les champs ajoutés qu'iOS ignore.
- [ ] Tester isolement A/B, membre simple, responsable de deux clubs et le parcours Playwright complet sur émulateurs ; rédiger `RAPPORT-PHASE-4.md` avec décision multiclub.

## Phase 5 — SMS, rappels et campagnes

**État : non commencée.**

- [ ] Abstraire `SmsProvider`, prévoir une implémentation Brevo et d'autres fournisseurs ; Secret Manager, webhooks authentifiés et suivi de livraison, gestion immédiate du STOP.
- [ ] Normaliser les numéros E.164, compter les segments GSM-7/Unicode, mettre staging en dry-run sauf liste blanche ; canal SMS dans l'outbox, relances et idempotence.
- [ ] Définir les contacts sans dupliquer les membres, déduplication et historique des consentements par canal/nature ; préférences par lien signé et désabonnement.
- [ ] Rappels planifiés et idempotents, campagnes responsables avec audience, estimation, confirmation, programmation, quota, alerte, journal, limite de débit et masquage des données dans les logs.
- [ ] Décisions à valider : fournisseur final ; expéditeur par défaut `ASSODARTS` et éventuelle personnalisation club, maximum 11 caractères ; rappels activés par défaut ; plages non urgentes 8 h–20 h en semaine, ni dimanche ni jour férié ; quota mensuel de SMS — **aucune valeur par défaut n'a été fournie**. Faire vérifier les exigences applicables avant livraison.
- [ ] Tests de segments, plages et jours fériés, quota, consentements, STOP, idempotence et dry-run ; preuve staging d'un SMS livré vers un numéro autorisé ; rapport phase 5 et estimation des coûts.

## Hors périmètre des phases correspondantes

Paiement en ligne des événements et facturation des abonnements restent hors des phases indiquées par le cahier des charges. Les notifications push FCM existent côté app ; leur évolution n'est pas comprise dans la phase SMS. La mention « paiement en ligne », « facturation » ou « SMS » dans les séparateurs de phases indique des travaux ultérieurs, pas une fonctionnalité déjà livrée.

## Actions manuelles à préparer

- [ ] Valider le premier rollout du backend staging créé ; préparer séparément le backend de production et son environnement, uniquement avec validation du propriétaire.
- [ ] Déclarer staging `staging.assodarts.app`, `admin.staging.assodarts.app`, `*.staging.assodarts.app` ; production `assodarts.app`, `www.assodarts.app`, `admin.assodarts.app`, `*.assodarts.app`. Suivre les instructions Firebase de validation de domaine et de certificats.
- [ ] Préserver les enregistrements DNS explicites (dont DKIM/SPF Resend) : ils ne doivent pas être supprimés à cause du générique.
- [ ] Configurer les domaines autorisés Firebase Auth pour les hôtes admin et localhost, les secrets et leurs droits, App Check, IAM/OIDC et les validateurs GitHub ; ne jamais saisir de secret dans Git.
- [ ] Vérifier les étapes réelles et les autorisations avant tout déploiement ; le propriétaire conserve la validation production. Les commandes et preuves disponibles sont dans `DEPLOY.md`.
