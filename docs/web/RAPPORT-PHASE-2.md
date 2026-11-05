# Phase 2 — état d'avancement

**Phase en cours : ne pas déployer en production.** Ce rapport couvre la phase 2 et son actualisation visuelle. L'état courant de l'espace Auth/rôles est documenté séparément dans [RAPPORT-PHASE-4.md](RAPPORT-PHASE-4.md); les points ci-dessous restent ouverts pour la phase 2.

## Audit et choix

- `backend/firestore.rules` et `functions/src/shared/auth.ts` utilisent les adhésions actives `memberships/{clubId}_{authUid}` et les rôles `admin` / `board`. `platform_admins` reste réservé au serveur. Les IDs de membre et les UID Auth restent distincts.
- Les événements `events/{eventId}` sont utilisés par `RemoteModels.swift` et `RemoteRepository.swift` et n'avaient pas de visibilité ; les champs et les mises à jour iOS existants restent acceptés. La visibilité absente signifie **members** (`// DECISION`).
- Les tournois et résultats existants contiennent des données nominatives et ne constituent pas une source publique validée. Pas de page résultats en attendant un modèle public et les autorisations nécessaires.
- `createClub` crée toujours un UUID et renvoie toujours `{clubId}` ; il attribue désormais un slug unique en transaction, avec suffixe en cas de collision. Pas de changement iOS requis.

## Réalisations

- Projections `clubs_public` / `events_public` calculées par Functions, liste de champs explicite, publication du profil désactivée par défaut (`clubs/{id}.publicProfile.isPublished`), pas d'écriture client. Les règles exigent également que le club associé soit publié avant de lire un événement public. Les triggers relisent les sources en transaction pour éviter les mises à jour hors ordre.
- Backfill des projections publiques dans `backend/functions/scripts/backfill-public.cjs`, limité à l'émulateur. Le script distinct `backfill-club-slugs.cjs` prépare les slugs historiques en mode dry-run par défaut et refuse les projets hors `demo-*`; aucune donnée réelle n'a été migrée.
- `setClubSlug` vérifie rôle et unicité dans la transaction ; alias conservés indéfiniment (`// DECISION`). Le schéma Zod de `shared/src/index.ts` est copié dans le paquet Functions pour respecter le périmètre de déploiement Firebase ; le build et le lint vérifient leur égalité dans le monorepo.
- Pages publiques club, agenda et événement, métadonnées, JSON-LD, image Open Graph, robots et sitemap ; les données du club et de l'événement sont revérifiées côté serveur. Les profils affichent les médias et liens sociaux HTTPS publiés ; les événements affichent catégories et fin quand disponibles. Les résolutions de slug sont mises en cache 60 secondes ; la publication est relue à chaque requête. `noindex` de staging est prévu via `ROOT_DOMAIN`. La vitrine et son texte sont provisoires.
- Les fonctions et tests de règles sont intégrés au job émulateur existant, sans rajouter de runner macOS.

## Vérifications locales

- Functions : lint, build et 24 suites / 231 tests Jest réussis.
- Règles Firebase : les deux tests Firestore (isolation/adhésion et projections publiques) passent sur l'émulateur existant. Le test Storage n'a pas pu être rejoué : son émulateur temporaire n'a pas démarré dans cet environnement.
- Firestore émulé : deux clubs, événements publics et privés ; backfill exécuté deux fois avec vérification d'absence de réécriture ; droits, alias et concurrence sur un slug réussis (`scripts/test-public-emulator.cjs`).
- Web : lint, typecheck, 28 tests Vitest et build Next réussis. Les smoke tests HTTP slug et custom-domain réussissent sur Firestore émulé : rendu profil/agenda/événement, champs média et sociaux, catégories/fin, alias 308, OG, robots/sitemap et 404 privé/inconnu (`web/scripts/test-public-pages.mjs`, `web/scripts/test-custom-domain.mjs`).
- Lighthouse mobile, accessibilité clavier, déploiement staging et validation CI distante : **pas encore mesurés / vérifiés**.

## Écarts et reste à faire

- [ ] Un alias utilise `permanentRedirect` de Next.js et renvoie **308** au lieu du **301** demandé. Trouver une solution compatible avec la contrainte de ne pas appeler Firestore depuis le middleware.
- [x] Préparer une procédure de slug backfill réelle, paginée, transactionnelle, dry-run par défaut et vérifiable sur émulateur. La migration des clubs réels reste à autoriser et exécuter séparément.
- [x] Tests de création de club en collision, projections/revalidation, droits, alias et backfill; un smoke test staging reste requis pour prouver les triggers déployés.
- [x] Rendre les domaines personnalisés sur profil, agenda, événement, robots et sitemap; tests HTTP émulés pour les routes et les cas 404.
- [x] Ajouter la revalidation à la demande protégée et l'invalidation ciblée par club/événement; l'appel live et le comportement de changements rapides restent à vérifier en staging.
- [ ] Consolider les messages français des nouvelles pages ; finaliser la vitrine et un moyen de contact réel après validation produit.
- [x] Les horaires restent textuels et les liens sociaux ne sont publiés que s'ils sont des URL HTTPS valides; l'édition web et la validation complète des champs sont prévues en phase 4.
- [ ] Tester et mesurer Lighthouse mobile (performance, accessibilité et SEO ≥ 90), l'accessibilité au clavier, le contraste et le `noindex` de staging.
- [ ] Préparer un test HTTP dans la CI et vérifier les résultats de la CI distante ; aucun déploiement n'a été effectué ici.

## Actualisation — domaines custom, backfill et cache (5 novembre 2026)

### Réalisé

- Les hôtes de `domains/{host}` utilisent les projections publiées pour rendre le profil, l'agenda et le détail événement. Chaque résolution vérifie l'hôte reçu et `clubs_public.isPublished`; les pages club non publiées restent en 404.
- Les domaines custom ont des handlers dédiés `robots.txt` et `sitemap.xml`; les URL canoniques restent sur le sous-domaine slug.
- Les événements publics sont mis en cache 60 secondes avec tags par club/événement; `/api/revalidate` valide un secret Bearer en temps constant et invalide les tags autorisés après validation Zod. Tests Vitest : secret absent/invalide, payload invalide et succès/tagging.
- Les triggers `onPublicClubWritten`/`onPublicEventWritten` appellent cet endpoint après mise à jour des projections. `WEB_REVALIDATION_URL` est configurée dans l'environnement GitHub staging; `WEB_REVALIDATION_SECRET` a été créé dans Secret Manager staging et l'accès App Hosting a été accordé. Le workflow écrit l'URL dans un `.env.assodarts-staging` éphémère au déploiement Functions; l'appel effectif reste à vérifier après rollout.
- `backfill-club-slugs.cjs` parcourt `clubs` par pages de 100, prend la transaction Firestore pour éviter les courses, conserve un slug existant/alias, suffixe les collisions et reste limité aux projets `demo-*` avec dry-run par défaut. Le test d'émulateur vérifie dry-run, collision, alias et idempotence.

### Vérifications locales

- `npm run test:domain` sur l'émulateur : domaine publié, agenda, événement avec JSON-LD, robots/sitemap passent; domaine non publié et hôte inconnu renvoient 404.
- Le test Functions `scripts/test-public-emulator.cjs` passe avec le backfill des slugs et des projections, après deux exécutions idempotentes.
- Web : lint, typecheck, 28 tests Vitest et build Next réussis après l'ajout du custom-domain et de la revalidation.

### Reste à faire

- Le 308 des alias diffère du 301 demandé. Les Server Components Next imposent 308 pour `permanentRedirect`; lire Firestore dans le middleware violerait l'architecture décidée. Une décision d'architecture est nécessaire pour fermer cet écart.
- L'URL et le secret staging sont provisionnés et le code des triggers est raccordé; l'appel n'est pas encore prouvé parce qu'aucun rollout Functions/App Hosting staging n'a été exécuté. La revalidation instantanée dépend de ce rollout et d'un smoke test.
- Le backfill n'a été exécuté que sur émulateur. Aucun slug historique n'a été migré en staging ou production.
- Lighthouse ≥90, accessibilité clavier, `noindex` et les pages sur App Hosting n'ont pas encore de preuve en ligne. Le premier rollout staging est un prérequis manuel après merge/CI sur release.

## Actions manuelles et risques

- [ ] Valider le premier rollout du backend App Hosting staging créé depuis l'audit phase 1, suivant `DEPLOY.md`. Vérifier domaines, DNS, certificats, en-têtes de proxy et domaine autorisé Auth. Déployer seulement après validation des points précédents.
- [ ] Valider le texte marketing, les données publiques proposées, le maintien indéfini des alias et la durée de cache.
- La publication est volontairement opt-in. Aucun résultat nominatif ni inscription publique n'est exposé. Les inscriptions iOS existantes restent inchangées et leur convergence avec la phase 3 reste à arbitrer.
- Firebase Functions utilise Node 24 ; le web Node 26. Le middleware Next 16 est déprécié au profit de `proxy` ; sa migration reste à planifier avec ses tests de routage.

## Actualisation — rafraîchissement des pages web (5 novembre 2026)

### Réalisé

- Reprise des tons clairs de `Theme.swift` (canvas `#F6F7F4`, surfaces blanches, bordures grises, texte `#17233A`, touches orange/vert), utilisation de la marque iOS comme asset local et shell responsive avec navigation de club et liens contact. Les grands aplats navy et l'adaptation sombre automatique ont été retirés; le marine reste réservé aux actions primaires et petits accents.
- Refonte de la vitrine, du profil club, de l'agenda, du détail d'événement, de `/admin` et des 404. Les pages métier continuent de lire les projections publiques côté serveur.
- Les profils affichent désormais logo/couverture et liens sociaux HTTPS valides; les événements exposent leurs catégories et date de fin lorsqu'elles existent, y compris dans le JSON-LD `Event`.
- À la date de cette actualisation UI, avant l'implémentation partielle de la phase 4, la connexion responsable et les inscriptions n'étaient pas encore disponibles. La copie marketing reste provisoire ; aucun essai gratuit ni contact commercial non validé n'est promis.
- Assets image et fontes statiques exemptés des réécritures d'hôte afin qu'ils fonctionnent sur les sous-domaines de club.

### Vérifications

- Web : `npm run lint`, `npm run typecheck`, `npm test` (28 tests) et `npm run build` réussis.
- Démo Firestore : profil `club-a`, agenda (événements à venir et passé) et détail événement rendus sur `club-a.localhost`; l'asset de marque répond HTTP 200 sur ce sous-domaine.
- Contrôle navigateur : profil club, agenda et événement testés à 360 px sans débordement horizontal. Aucun score Lighthouse ni audit clavier/contraste n'a été produit.
- Le smoke test custom-domain a également vérifié en HTTP les routes publiques après l'actualisation des champs de profil et d'événement.

### Écarts et suites

- À la date de cette actualisation visuelle, `/admin` était encore une page d'état; le portail Firebase Auth a depuis été démarré en phase 4. Les inscriptions restent en phase 3 et les résultats publics ne sont toujours pas exposés.
- Le build est prêt mais aucun déploiement staging n'a été exécuté. Le premier rollout CI, les contrôles d'accessibilité et le score Lighthouse restent à obtenir.
- La migration `middleware` vers `proxy`, le 308 des alias, les slugs historiques, la revalidation live et les actions manuelles staging restent ouverts comme indiqué dans le suivi ci-dessus.
