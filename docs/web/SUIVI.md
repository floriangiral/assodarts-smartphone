# Suivi du site web multi-club

Dernière vérification : **5 novembre 2026**, `develop` au commit `2092e82` avant cette mise à jour documentaire. Référence des exigences : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md). Plan des pages : [PLAN-PAGES.md](PLAN-PAGES.md). État global et sécurité : [SUIVI-CHANTIERS.md](../SUIVI-CHANTIERS.md).

**Aucune phase n'est terminée.** Les cases non cochées incluent les tâches qui n'ont pas été réalisées ou dont la preuve manque. Les valeurs par défaut ci-dessous sont des intentions du cahier des charges, pas des fonctionnalités déjà appliquées.

## Principes transverses

- [ ] Avant chaque phase, auditer les modèles, rôles, règles, Functions et CI concernés ; citer les fichiers et traiter les contradictions sans les masquer.
- [ ] Respecter les identifiants UUID de club et de membre, distinguer `memberId` et `authUid`, conserver la sémantique de `clubId` et `defaultClubId`, et réutiliser `memberships` et `platform_admins`.
- [ ] Utiliser App Router Next.js, TypeScript strict, Tailwind/shadcn, Firebase Admin serveur pour le public et SDK navigateur pour l'admin, messages français centralisés, Zod partagé, Vitest, Playwright et Local Emulator Suite.
- [ ] Garder les secrets dans Secret Manager ; les clés Firebase des clients sont des identifiants publics. Aucun secret ne doit figurer dans le dépôt ou en clair dans `apphosting.yaml`.
- [ ] Fournir les preuves de tests, builds, émulateurs et déploiements pertinentes ; toute modification de règles exige des tests de refus et d'autorisation.
- [ ] Produire pour chaque phase `RAPPORT-PHASE-N.md` avec les sept rubriques demandées dans le cahier des charges. Aucun de ces rapports n'existe encore ; ne pas les créer comme rapports de phase finie avant validation.
- [ ] Commits atomiques sur `develop`, PR `develop → release-*`, sans rebase ni force-push sur les branches partagées. Le propriétaire garde les merges et la production.

## Phase 1 — socle, hôtes et staging

**État : partiel, non terminé.** L'audit initial et le schéma de slug ont été commités. Un squelette web est versionné avec un gestionnaire local ; il n'a pas été déployé.

### Réalisé ou observé

- [x] Audit initial : [AUDIT-INITIAL.md](AUDIT-INITIAL.md), qui contient aussi des constatations historiques datées.
- [x] `shared/src/index.ts` propose `clubSlugSchema`, une liste réservée et `slugify` ; 46 tests Vitest ont réussi localement. Le package n'est pas encore consommé par le web ou les Functions.
- [x] Le squelette local `web/` contient des pages de substitution, un résolveur d'hôtes, des fichiers Firebase et des configurations App Hosting provisoires. En local, vitrine, club et admin ont répondu HTTP 200 ; `/c/test-club` a répondu 301 vers le sous-domaine. Aucun parcours métier n'a été validé.
- [x] Lors de l'ajustement local, le lockfile web a été orienté vers le registre npm public et `npm ci --ignore-scripts` a réussi. Le lockfile est désormais versionné avec le squelette.
- [x] Un job web Linux est défini dans `quality.yml` quand le dossier est suivi et concerné. Il a été sauté lors du run historique observé avant l’intégration du web ; aucun run web réussi n’est encore prouvé.

### Reste à faire

- [ ] Confirmer la CI après correction du lockfile `shared/`, de la dépendance gRPC web et des versions CodeQL. Shared, règles, scan et Functions ont réussi sur `59b56ba` ; le run web a échoué sur une URL de registre privé corrigée depuis. Vérifier le commit final et le run iOS.
- [ ] Valider en CI le socle web versionné : lint, typage, tests, build, audit npm, Prettier et mode sombre. shadcn/Tailwind a été initialisé ; la vérification visuelle et les tests E2E restent à réaliser.
- [ ] Valider l’intégration du package partagé au build App Hosting et définir son intégration à l’archive déployée des Functions. Le web consomme déjà le schéma de slug partagé ; les Functions ne le consomment pas encore.
- [ ] Terminer le routage : racine et www, admin, slug club, 301 canonique, redirection admin, domaines inconnus via `domains/{host}` côté serveur, hôte et port normalisés. Le middleware ne doit pas interroger Firestore. Vérifier les en-têtes de proxy de confiance et éviter les boucles.
- [ ] Ajouter la résolution serveur slug → club avec cache lorsque les données nécessaires existeront. En phase 1, ne pas créer prématurément `club_slugs` ni de Function métier.
- [ ] Documenter et tester un mode local de secours quand `*.localhost` ne se résout pas ; compléter les tests de toutes les règles d'hôtes, slugs réservés, Unicode et erreurs.
- [ ] Compléter 404 générique et 404 club, messages FR centralisés, initialisation Firebase serveur unique et client paresseuse ; valider que rien ne déclenche de lecture réelle par accident.
- [ ] Créer `docs/web/DEPLOY.md`, les configurations App Hosting et, si nécessaire, les variantes staging/production. Configurer la CI pour déployer automatiquement staging sur `release-*`, et production seulement par `workflow_dispatch` protégé et approuvé. Désactiver les rollouts App Hosting automatiques s'ils contournent la CI.
- [ ] Préparer les domaines et secrets ; vérifier l'Auth autorisée uniquement sur les hôtes admin et localhost. Le propriétaire réalise ou valide les opérations de console/DNS requises. Aucune preuve de backend App Hosting ni de déploiement staging n'existe actuellement.
- [ ] Exécuter les builds et tests web et Functions, les vérifications locales HTTP, les contrôles CI et la checklist staging ; créer `RAPPORT-PHASE-1.md` avec les résultats et les éventuels blocages manuels.

## Phase 2 — pages publiques et projections

**État : non commencée.**

- [ ] Auditer précisément les événements, catégories, tournois, résultats et règles existants ; décider si une page de résultats est techniquement exploitable.
- [ ] Créer `clubs_public` et `events_public` avec seuls champs publics, triggers de projection et backfill idempotent. Les lectures publiques doivent être limitées aux documents publiés ; aucune écriture client. Tester autorisations et refus.
- [ ] Ajouter au document source `visibility: public | members` ; **décision à valider, défaut demandé pour l'existant : `members`**.
- [ ] Créer `club_slugs/{slug}` et `setClubSlug` avec droits existants, validation partagée, transaction d'unicité, alias et redirection 301. Proposer un slug à la création d'un club sans modifier l'ID UUID ; analyser l'impact de `createClub` et sur iOS.
- [ ] Décision à valider : conservation des alias ; défaut demandé **indéfinie** pour protéger les QR codes. Tester collisions concurrentes, réservés, alias et droits.
- [ ] Résoudre slug, alias et publication côté serveur avec cache et invalidation ; défaut demandé de revalidation temporelle 60 s. Revalidation à la demande protégée ou dette explicitée.
- [ ] Réaliser pages club, agenda et événement ; la page résultats seulement si les données le permettent. Vitrine provisoire, métadonnées, canonicals, sitemap/robots par hôte, Open Graph événement, données structurées, `noindex` staging.
- [ ] Vérifier mobile, clavier, libellés, contrastes ; mesurer Lighthouse mobile ≥ 90 en performance, accessibilité et SEO sur la page événement.
- [ ] Exécuter un backfill sur émulateur avec deux clubs et des événements publics/privés ; prouver rendu serveur, alias et 404 ; rédiger `RAPPORT-PHASE-2.md`.

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

- [ ] Créer les backends Firebase App Hosting staging et production, lier le dépôt et sélectionner le bon environnement/runtime ; désactiver les déploiements automatiques qui contournent la CI. Valider le support effectif des versions Next et Node au moment de la création.
- [ ] Déclarer staging `staging.assodarts.app`, `admin.staging.assodarts.app`, `*.staging.assodarts.app` ; production `assodarts.app`, `www.assodarts.app`, `admin.assodarts.app`, `*.assodarts.app`. Suivre les instructions Firebase de validation de domaine et de certificats.
- [ ] Préserver les enregistrements DNS explicites (dont DKIM/SPF Resend) : ils ne doivent pas être supprimés à cause du générique.
- [ ] Configurer les domaines autorisés Firebase Auth pour les hôtes admin et localhost, les secrets et leurs droits, App Check, IAM/OIDC et les validateurs GitHub ; ne jamais saisir de secret dans Git.
- [ ] Vérifier les étapes réelles et les autorisations avant tout déploiement ; le propriétaire conserve la validation production. Les commandes détaillées et leur preuve doivent être rédigées dans `DEPLOY.md` lors de la phase 1.
