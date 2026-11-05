# Cahier des charges initial — transcription

Ce texte reprend la demande fournie au début du chantier. Il exprime la cible, pas l’état livré. Pour l’état à jour et les écarts constatés, consulter [SUIVI.md](SUIVI.md).

---

Assodarts est un SaaS de gestion de clubs de fléchettes (marché FFD). Le dépôt assodarts-smartphone contient :
- l'app iOS SwiftUI ;
- le backend Firebase : Firestore, Firebase Auth, Cloud Functions Node/TypeScript dans backend/functions/ (tests Jest), FCM ;
- l'envoi de mails transactionnels via Resend, appelé depuis des Cloud Functions (pas l'extension Trigger Email) ;
- Stripe Connect pour les paiements club → membres ;
- la CI GitHub Actions (quality.yml) + Codemagic pour iOS.
On ajoute un site web multi-club dans un nouveau dossier web/, branché sur le même projet Firebase (staging : assodarts-staging, puis prod).
- assodarts.app : vitrine du SaaS.
- {slug}.assodarts.app : page publique d'un club (présentation, agenda, événements, inscriptions, résultats).
- assodarts.app/c/{slug} : même contenu, redirigé en 301 vers le sous-domaine (URL canonique = sous-domaine).
- admin.assodarts.app : espace privé des responsables, centralisé (jamais de connexion sur les sous-domaines de club).
- Inscription publique aux événements sans compte, mails (Resend) et SMS (fournisseur à abstraire, Brevo pressenti).
- Next.js (App Router) + TypeScript strict, hébergé sur Firebase App Hosting.
- Tailwind CSS + shadcn/ui.
- firebase-admin côté serveur pour les pages publiques ; SDK Firebase JS côté navigateur pour l'espace privé.
- Zod pour la validation, schémas partagés entre web/ et backend/functions/.
- Vitest (logique) + Playwright (parcours de bout en bout).
- Locale fr-FR par défaut, textes prévus pour être traduisibles plus tard (pas de chaînes en dur dispersées : un fichier de messages).
1. Les IDs de club sont des UUID (crypto.randomUUID()), jamais des slugs. Le slug est un champ séparé.
2. Deux espaces d'identifiants distincts : l'UID Firebase Auth est stocké dans le champ authUid des documents members ; l'ID de document members est un UUID généré côté client. Ne jamais comparer un memberId à un uid.
3. clubId (premier club, figé) et defaultClubId (préférence de navigation) sur les documents membres : ne pas changer leur sémantique.
4. L'accès administrateur plateforme passe par la collection platform_admins, jamais écrivable côté client.
5. Les clés API Firebase côté client sont des identifiants publics ; les secrets (Resend, SMS, etc.) vont dans Secret Manager, jamais dans le dépôt ni dans apphosting.yaml en clair.
6. Le web réutilise les rôles existants des membres : pas de deuxième système de permissions.
- Travailler et commiter directement sur develop, pas de branche de feature.
- Mettre à jour la PR develop → release-v* déjà ouverte, ou en ouvrir une nouvelle.
- Pas de rebase, pas de force-push sur les branches partagées.
- Je garde la main sur les merges et sur tout déploiement en production.
- Commits atomiques, messages clairs (web: …, functions: …, rules: …, ci: …).
- Diagnostiquer avant de coder : commence chaque phase par un audit ciblé du code existant (modèles, rôles, règles, Functions, CI). Ne devine jamais une structure : lis-la et cite les fichiers.
- Si l'existant contredit ce prompt, arrête-toi sur ce point précis, explique l'écart avec preuves et propose une option ; continue le reste si ce n'est pas bloquant.
- Décisions produit : ne les tranche pas en silence. Implémente la valeur par défaut indiquée si elle existe, marque-la clairement dans le code (// DECISION: …) et liste-la dans le rapport.
- Si un test encode un comportement que tu corriges, corrige aussi le test.
- Toute modification des règles Firestore s'accompagne de tests de règles (émulateur) couvrant les cas autorisés et refusés.
- Tout ce qui touche à Firebase doit pouvoir tourner avec la Firebase Local Emulator Suite.
- Rien n'est « terminé » sans preuve : sorties de tests, build, captures ou logs. Pas de « ça devrait marcher ».
Termine chaque phase par un rapport docs/web/RAPPORT-PHASE-N.md contenant :
1. Ce qui a été fait (fichiers créés ou modifiés, par zone).
2. Résultats des tests et du build (sorties résumées).
3. Écarts constatés entre ce prompt et l'existant, et ce que tu as fait.
4. Décisions produit en attente, avec la valeur par défaut appliquée.
5. Actions manuelles que je dois faire (console Firebase, DNS, secrets…), sous forme de checklist.
6. Ce qui a été consolidé ou volontairement laissé séparé, et pourquoi.
7. Risques et dette identifiés.
Avoir un squelette Next.js déployé en staging sur App Hosting, avec la résolution hôte → club en place, la validation des slugs et une CI verte. Aucune fonctionnalité métier encore.
- Structure du dépôt, outillage Node (version, gestionnaire de paquets, workspaces éventuels), configuration firebase.json, .firebaserc.
- Modèle actuel des clubs, membres, rôles et événements (collections, champs, types TypeScript côté Functions, modèles Swift correspondants).
- Fichiers de règles Firestore et tests de règles existants.
- Jobs de quality.yml et logique de déploiement staging/prod.
- Proposer où vivent les schémas Zod partagés (ex. shared/ en workspace npm consommé par web/ et backend/functions/) et le justifier. Ne pas casser le build des Functions.
- Next.js App Router, TypeScript strict, ESLint, Prettier alignés sur les conventions du dépôt.
- Tailwind + shadcn/ui initialisés, avec un thème de base sobre (couleurs en variables CSS, mode sombre supporté).
- Arborescence cible :
  - app/(marketing)/ : vitrine assodarts.app (page d'accueil minimale pour l'instant) ;
  - app/c/[slug]/ : pages publiques club (placeholder « page du club » pour l'instant) ;
  - app/admin/ : espace privé (placeholder « connexion » pour l'instant) ;
  - lib/firebase/server.ts (firebase-admin, initialisé une seule fois) et lib/firebase/client.ts (SDK client, initialisé paresseusement, uniquement côté navigateur).
- Fichier de messages fr centralisé.
- Pages d'erreur propres : 404 générique et 404 « ce club n'existe pas ».
Implémente middleware.ts + un module pur lib/routing/resolveHost.ts (testé unitairement) :
- Lit l'hôte depuis X-Forwarded-Host (App Hosting), puis Host en repli ; normalise (minuscules, sans port).
- Domaines racine configurables par variable d'environnement : ROOT_DOMAIN (assodarts.app en prod, staging.assodarts.app en staging, localhost en local).
- Règles :
  - hôte racine ou www. → vitrine ;
  - admin.{ROOT_DOMAIN} → réécriture vers /admin/… ;
  - {slug}.{ROOT_DOMAIN} → réécriture interne vers /c/{slug}/… ;
  - {ROOT_DOMAIN}/c/{slug}/… → redirection 301 vers {slug}.{ROOT_DOMAIN}/… ;
  - accès direct à /admin depuis un sous-domaine club → redirection vers admin.{ROOT_DOMAIN} ;
  - tout autre hôte → recherche dans domains/{host} (prévu pour les domaines personnalisés futurs), sinon 404.
- En local : supporter {slug}.localhost:3000 et un paramètre de secours documenté.
- Le middleware ne fait aucun appel Firestore : il ne fait que réécrire. La résolution slug → clubId se fait dans la page (serveur), avec cache.
Dans les schémas partagés, clubSlugSchema :
- minuscules, a-z, 0-9, tiret ; 3 à 40 caractères ; pas de tiret en début ou fin ; pas de double tiret ;
- liste réservée exportée (RESERVED_SLUGS) : www, app, admin, api, mail, email, smtp, staging, dev, test, preview, support, help, status, blog, docs, static, cdn, assets, auth, login, account, billing, assodarts, ffd ;
- fonction slugify(name) pour proposer un slug à partir du nom du club (accents retirés, etc.).
- Tests Vitest/Jest exhaustifs (cas valides, invalides, réservés, unicode).
- Pas encore de collection club_slugs ni de Function : c'est la phase 2.
- Créer web/apphosting.yaml (+ variantes par environnement si nécessaire : apphosting.staging.yaml) avec les variables non secrètes (ROOT_DOMAIN, ID de projet…) et des références Secret Manager pour les secrets futurs.
- Vérifie dans la documentation Firebase actuelle comment déclencher les déploiements App Hosting. Objectif : rester cohérent avec le pipeline existant :
  - staging déployé automatiquement par la CI sur les branches release-* ;
  - prod uniquement en workflow_dispatch protégé par l'environnement GitHub à validateurs requis ;
  - si les déploiements automatiques sur branche d'App Hosting entrent en conflit avec ce schéma, privilégier un déploiement piloté par la CI et le documenter.
- Écrire docs/web/DEPLOY.md : création des backends staging et prod, liaison au dépôt, domaines à déclarer, secrets à créer, commandes.
- Staging : staging.assodarts.app, admin.staging.assodarts.app, générique *.staging.assodarts.app.
- Prod : assodarts.app, www.assodarts.app, admin.assodarts.app, générique *.assodarts.app.
- Rappeler que les enregistrements explicites (DKIM/SPF Resend, etc.) priment sur le générique et ne doivent pas être supprimés.
- Firebase Auth → domaines autorisés : uniquement les hôtes admin (+ localhost). Les sous-domaines club n'ont pas besoin d'Auth.
- Ajouter à quality.yml un job web : installation, lint, typecheck, tests Vitest, next build.
- Le job secret-scan doit couvrir web/.
- Les jobs existants (Functions, iOS) ne doivent pas régresser.
- npm run build et les tests passent dans web/ et backend/functions/.
-  Tests unitaires de resolveHost couvrant chaque règle du 1.2.
-  En local : localhost:3000 → vitrine ; test-club.localhost:3000 → placeholder club ; localhost:3000/c/test-club → 301 vers le sous-domaine ; admin.localhost:3000 → placeholder admin.
-  Déploiement staging réussi (ou, si une action manuelle me bloque, checklist précise de ce qu'il me reste à faire).
-  Rapport docs/web/RAPPORT-PHASE-1.md.
Données réelles, connexion, inscriptions, mails, SMS.
Chaque club a un slug unique et une page publique (accueil, agenda, détail d'événement) rendue côté serveur, rapide et bien référencée, sans jamais exposer de données privées.
- Modèle exact des événements existants (collection, champs, statuts, catégories, tournois) et usage côté iOS.
- Ce qui existe déjà en matière de résultats et classements.
- Règles Firestore actuelles sur clubs et événements.
Les pages publiques ne lisent que des collections publiques dédiées, alimentées côté serveur :
- clubs_public/{clubId} : slug, name, city, description, logoUrl, coverUrl, address (si le club l'accepte), contactEmail public, socialLinks, schedule (horaires d'entraînement), isPublished, updatedAt.
- events_public/{eventId} : clubId, title, type, startsAt, endsAt, location, description, categories, registration (voir phase 3 pour le détail ; ici seulement ce qui s'affiche : ouvert ou fermé, places restantes, complet), status, updatedAt.
- Alimentation par triggers Cloud Functions à partir des documents sources (club, événement) + une fonction de backfill idempotente pour l'existant.
- Champ de visibilité sur l'événement source : visibility: "public" | "members" (défaut members pour l'existant — // DECISION).
- Règles : lecture publique uniquement sur ces collections et seulement si publié ; aucune écriture client. Tests de règles.
- Collection club_slugs/{slug} : { clubId, status: "active" | "alias", createdAt, aliasOf? }.
- Callable setClubSlug({ clubId, slug }) :
  - réservé aux rôles responsables du club (réutiliser l'helper de rôle existant) ou aux platform_admins ;
  - validation via clubSlugSchema + liste réservée ;
  - unicité garantie par transaction ;
  - l'ancien slug devient alias (redirection 301 vers le nouveau) ; durée de conservation des alias = // DECISION (défaut : indéfinie, pour ne pas casser les QR codes imprimés) ;
  - met à jour clubs_public/{clubId}.slug.
- À la création d'un club : slug proposé via slugify(name) avec suffixe numérique si collision. Vérifier l'impact sur la Function createClub existante et sur l'app iOS (l'app n'a pas besoin de changer pour l'instant, mais le rapport doit le dire).
- Tests Jest : unicité concurrente, réservés, alias, droits.
- Résolution slug → clubId dans une fonction serveur mise en cache (unstable_cache ou équivalent actuel, avec tags par club), gérant les alias (301) et les clubs non publiés (404).
- Pages :
  - / du club : présentation, prochains événements publics, horaires, contact ;
  - /agenda : événements publics à venir, puis passés ;
  - /e/[eventId] : détail de l'événement, avec emplacement réservé au futur formulaire d'inscription ;
  - /resultats : seulement si des données de résultats exploitables existent (sinon ne pas créer la page et le signaler).
- Revalidation : temporelle (60 s par défaut) + revalidation à la demande déclenchée par les triggers de projection (endpoint protégé par secret partagé) — si c'est trop complexe pour cette phase, le documenter comme dette.
- Vitrine assodarts.app : page simple (proposition de valeur, fonctionnalités, essai gratuit 14 jours, contact). Contenu provisoire marqué comme tel.
- metadata par page (titre, description), balise canonique pointant vers le sous-domaine.
- sitemap.xml et robots.txt par hôte (racine et chaque club).
- Images Open Graph générées par événement (nom du club, titre, date) pour de beaux aperçus dans les SMS et mails.
- Données structurées Event (schema.org) sur la page événement.
- Staging : noindex partout.
- Mobile d'abord : la majorité des visites viendra d'un lien SMS ou d'un QR code.
- Accessibilité : contrastes, navigation clavier, libellés.
- Lighthouse mobile ≥ 90 sur performance, accessibilité et SEO pour la page événement.
-  Tests de règles : lecture publique OK sur projections publiées, refus sur documents privés et projections non publiées.
-  Backfill exécuté sur l'émulateur avec un jeu de données de démo (2 clubs, plusieurs événements publics et privés).
- club-a.localhost:3000/e/{id} rendu côté serveur avec les bonnes données ; slug alias → 301 ; slug inconnu → 404 club.
-  Rapport docs/web/RAPPORT-PHASE-2.md avec score Lighthouse.
Formulaire d'inscription (phase 3), édition depuis le web (phase 4).
Un joueur ouvre le lien d'un événement, s'inscrit en moins de 30 secondes sans compte, reçoit une confirmation par mail, et peut se désinscrire via un lien unique. Jauge, liste d'attente et anti-spam gérés côté serveur.
- Existe-t-il déjà un modèle d'inscription aux événements côté iOS ou Functions ? Si oui, l'étendre plutôt que d'en créer un second, et le justifier.
- Implémentation actuelle de l'envoi Resend (fonction, modèles, gestion d'erreurs).
Sous-objet registration sur l'événement source (et sa projection publique pour les champs affichables) :
- mode: "closed" | "open", opensAt?, closesAt? ;
- capacity? (illimité si absent), waitlistEnabled (défaut true) ;
- categories? : liste de choix (simple, doublette, catégorie d'âge…) avec capacité optionnelle par catégorie ;
- fields : quels champs sont demandés (email / phone / les deux / au moins un — défaut : au moins un des deux, // DECISION), licenseNumber optionnel ;
- priceInfo? : texte d'information uniquement (pas de paiement en ligne dans cette phase).
Collection : à aligner sur l'existant après audit ; à défaut clubs/{clubId}/events/{eventId}/registrations/{registrationId}. Écriture uniquement côté serveur.
- firstName, lastName, email? (normalisé), phoneE164? (normalisé avec libphonenumber-js, pays par défaut FR), licenseNumber?, category? ;
- status: "confirmed" | "waitlisted" | "cancelled", waitlistPosition?, createdAt, cancelledAt? ;
- source: "web" | "app" | "admin" ;
- consents : { emailTransactional, smsTransactional, marketing }, chacun { granted, at, textVersion } — le texte exact du consentement est versionné ;
- cancelTokenHash : hash SHA-256 du jeton de désinscription (le jeton en clair n'est jamais stocké) ;
- memberId? : rattachement à un membre existant. Le rattachement automatique par e-mail est une // DECISION (défaut : non, pas de rattachement automatique).
- Projection : le nombre d'inscrits confirmés et l'état complet/liste d'attente sont reflétés dans events_public. Aucune donnée personnelle dans la projection publique. La liste publique des inscrits (prénom + initiale du nom) est une option par événement, // DECISION (défaut : désactivée).
- publicRegister (v2, App Check obligatoire) :
  - validation Zod partagée ; champ piège (honeypot) ; limitation de débit par IP hachée et par événement ;
  - vérifie que l'événement est public, ouvert, dans la fenêtre d'inscription ;
  - transaction : déduplication (même e-mail ou même téléphone sur le même événement → réponse idempotente, pas de doublon), contrôle de capacité globale et par catégorie, attribution confirmed ou waitlisted ;
  - génère le jeton de désinscription, stocke son hash, place le mail de confirmation dans l'outbox ;
  - renvoie un statut clair au front : confirmed, waitlisted (avec position), already_registered, full, closed.
- publicCancelRegistration({ token }) : annule, puis promeut automatiquement le premier de la liste d'attente dans la même transaction et lui envoie un mail. Idempotent.
- App Check : reCAPTCHA Enterprise côté web ; vérifier que les sous-domaines club sont acceptés par la clé ; jeton de debug pour l'émulateur et le local.
- Collection outbox/{messageId} : channel: "email" | "sms", to, template, data, clubId, eventId?, status: "pending" | "sending" | "sent" | "failed" | "dead", attempts, nextAttemptAt, providerMessageId?, error?, createdAt, sentAt?, idempotencyKey.
- Trigger onCreate → envoi ; relance avec backoff exponentiel (3 tentatives) ; état dead après échec définitif.
- Brancher l'outbox sur l'intégration Resend existante (la réutiliser, ne pas la dupliquer). Expéditeur centralisé, nom d'expéditeur = nom du club.
- Modèles de mail FR (HTML responsive + version texte) : confirmation, mise en liste d'attente, promotion depuis la liste d'attente, annulation confirmée. Chaque mail contient le lien de désinscription et le lien vers la page de l'événement.
- Formulaire court, mobile d'abord, validation instantanée, messages d'erreur clairs en français.
- Cases de consentement non précochées, avec texte versionné et lien vers la politique de confidentialité.
- Écrans de résultat distincts pour chaque statut renvoyé.
- Page /annulation?token=… : confirmation avant annulation, puis message de résultat.
- Mise à jour en direct des places restantes (écoute de la projection publique côté client, ou revalidation).
- Mention d'information sous le formulaire (finalité, responsable = le club, durée de conservation).
- Durée de conservation des inscriptions après l'événement : // DECISION (défaut : 12 mois), avec une fonction planifiée de purge ou d'anonymisation.
- Vérifier que la politique de confidentialité actuelle couvre ce traitement ; sinon le signaler (ne pas la réécrire seul).
-  Tests Jest : capacité atteinte, liste d'attente, promotion à l'annulation, déduplication, fenêtre fermée, événement non public, jeton invalide, concurrence (inscriptions simultanées sur la dernière place).
-  Tests de règles : aucune écriture client sur inscriptions ni outbox.
-  Test Playwright de bout en bout sur l'émulateur : inscription → mail en outbox → lien d'annulation → promotion du suivant.
-  Rapport docs/web/RAPPORT-PHASE-3.md.
Paiement en ligne (Stripe), SMS (phase 5), gestion côté responsables (phase 4).
Les responsables d'un ou plusieurs clubs se connectent avec leur compte Assodarts habituel et gèrent événements, inscriptions et page publique depuis le web.
Les règles Firestore actuelles s'appuient sur clubId et defaultClubId et ne passent pas à l'échelle pour N clubs (limite connue). Un responsable de plusieurs clubs doit pouvoir les gérer tous depuis le web.
- Analyser les options, par exemple : documents de rôle indexés par club et par authUid (ex. clubs/{clubId}/roles/{authUid}) lus par get() dans les règles et maintenus par les Functions ; custom claims (limite de taille) ; tout passer par des callables.
- Proposer une recommandation argumentée et la soumettre avant d'implémenter si elle modifie les règles utilisées par l'app iOS. Si elle est rétrocompatible avec l'app, l'implémenter avec tests de règles et l'expliquer.
- Firebase Auth côté navigateur, mêmes fournisseurs que l'app iOS (vérifier lesquels).
- Après connexion : retrouver le(s) membre(s) par authUid (jamais par ID de document), puis les clubs où l'utilisateur a un rôle de responsable.
- Sélecteur de club si plusieurs ; mémorisation du dernier club choisi dans le navigateur (simple confort, pas de donnée critique).
- Utilisateur sans rôle responsable → écran explicite « Votre compte n'a pas d'accès responsable » avec lien vers l'app.
- Garde-fous côté client et côté règles/Functions (le client ne fait jamais foi).
- Pas de cookies de session ni de rendu serveur authentifié dans cette phase.
- Tableau de bord : prochains événements, nombre d'inscrits, listes d'attente, derniers inscrits.
- Événements : créer, modifier, dupliquer, annuler ; régler visibilité et configuration d'inscription (phase 3) ; aperçu de la page publique ; QR code téléchargeable (PNG + PDF A4 à afficher au club) et lien à copier.
- Inscrits : liste filtrable par statut et catégorie ; ajout manuel ; annulation ; passage manuel de la liste d'attente vers confirmé ; pointage le jour J ; export CSV compatible Excel FR (UTF-8 avec BOM, séparateur ;).
- Page publique du club : édition des champs de clubs_public (via le document source, la projection suit), logo et couverture (Firebase Storage, règles et tailles maximales), publication ou dépublication, changement de slug via setClubSlug avec avertissement sur les QR codes déjà imprimés.
- Annulation d'un événement : proposer de prévenir les inscrits par mail (passe par l'outbox).
- Les données créées ou modifiées depuis le web doivent être lisibles telles quelles par l'app (mêmes collections, mêmes champs, mêmes types — UUID notamment).
- Lister dans le rapport tout champ ajouté que l'app iOS ignore aujourd'hui.
-  Tests de règles : un responsable du club A ne peut ni lire ni modifier les données privées du club B ; un membre simple n'a pas accès ; un responsable de deux clubs gère les deux.
-  Tests Playwright : connexion (émulateur Auth), création d'événement public, apparition sur la page publique, inscription depuis la page publique, visibilité de l'inscrit dans l'admin, export CSV.
-  Rapport docs/web/RAPPORT-PHASE-4.md, incluant la décision prise au 4.0.
Envoi de campagnes, SMS (phase 5), facturation des clubs.
Les responsables envoient des annonces par mail et SMS aux contacts qui y ont consenti, et les inscrits reçoivent des rappels automatiques, avec maîtrise des coûts et conformité.
- Interface SmsProvider (send, parseStatusWebhook, parseInboundStop) avec une implémentation Brevo — le choix final du fournisseur reste une // DECISION ; une seconde implémentation doit pouvoir s'ajouter sans toucher au reste.
- Clé API dans Secret Manager.
- Expéditeur alphanumérique configurable (par défaut ASSODARTS, et éventuellement par club, 11 caractères max — // DECISION).
- Normalisation E.164, découpage et décompte des segments SMS (GSM-7 vs Unicode) affiché avant envoi.
- Staging : aucun SMS réel sauf vers une liste blanche de numéros de test configurée ; sinon mode « dry-run » qui écrit en outbox sans envoyer.
- Canal sms dans l'outbox de la phase 3 (mêmes états, relances, idempotence).
- Webhook de statut de livraison du fournisseur → mise à jour de l'outbox (endpoint authentifié par secret ou signature).
- Gestion du STOP (réponse ou lien de désinscription) → retrait immédiat du consentement correspondant.
- Notion de contact de club : membres + personnes inscrites via le web, dédupliqués par e-mail ou téléphone normalisé, collection à définir après audit (sans dupliquer les membres existants).
- Consentements par canal et par nature (transactional / marketing), historisés (date, source, version du texte), jamais déduits.
- Page publique de gestion des préférences accessible par lien signé dans chaque message (désabonnement en un clic).
- Rappels automatiques : fonction planifiée (onSchedule) qui envoie un rappel la veille de l'événement aux inscrits confirmés (mail, et SMS si consentement SMS), idempotente (jamais deux rappels pour la même inscription), réglable par événement (activé par défaut, // DECISION).
- Campagnes depuis l'admin : composer un message (mail et/ou SMS), choisir l'audience (tous les contacts consentants, membres seulement, inscrits d'un événement), aperçu du nombre de destinataires et du nombre de SMS facturés avant envoi, confirmation explicite, envoi différé possible.
- Plages horaires pour les messages non urgents : par défaut 8h–20h en semaine, ni dimanche ni jours fériés (règles applicables aux SMS commerciaux en France, appliquées par prudence à toutes les campagnes — // DECISION) ; les messages programmés hors plage sont décalés.
- Mention STOP obligatoire sur les SMS de campagne.
- Quota mensuel de SMS par club (valeur par défaut // DECISION), compteur, blocage clair une fois atteint, alerte à 80 %.
- Prévoir le lien futur avec les paliers d'abonnement (champ, pas de logique de facturation).
- Journal des envois consultable par le club (date, audience, nombre, statut).
- Seuls les responsables du club peuvent lancer une campagne pour ce club (vérification côté Function).
- Limite de débit sur les campagnes pour éviter un envoi massif accidentel.
- Aucune donnée personnelle dans les logs (numéros et e-mails masqués).
-  Tests Jest : décompte des segments, plages horaires et jours fériés, quota, idempotence des rappels, STOP → retrait du consentement, refus d'envoi sans consentement, dry-run staging.
-  Test de bout en bout en staging vers un numéro de la liste blanche (preuve : statut « livré » dans l'outbox).
-  Rapport docs/web/RAPPORT-PHASE-5.md, avec estimation du coût par club selon des volumes types.
Notifications push (FCM, déjà côté app), paiement des événements, facturation des abonnements clubs.
