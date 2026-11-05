# Phase 2 — état d'avancement

**Phase en cours : ne pas déployer en production.** Ce document décrit le travail effectivement vérifié ; les points ci-dessous restent ouverts.

## Audit et choix

- `backend/firestore.rules` et `functions/src/shared/auth.ts` utilisent les adhésions actives `memberships/{clubId}_{authUid}` et les rôles `admin` / `board`. `platform_admins` reste réservé au serveur. Les IDs de membre et les UID Auth restent distincts.
- Les événements `events/{eventId}` sont utilisés par `RemoteModels.swift` et `RemoteRepository.swift` et n'avaient pas de visibilité ; les champs et les mises à jour iOS existants restent acceptés. La visibilité absente signifie **members** (`// DECISION`).
- Les tournois et résultats existants contiennent des données nominatives et ne constituent pas une source publique validée. Pas de page résultats en attendant un modèle public et les autorisations nécessaires.
- `createClub` crée toujours un UUID et renvoie toujours `{clubId}` ; il attribue désormais un slug unique en transaction, avec suffixe en cas de collision. Pas de changement iOS requis.

## Réalisations

- Projections `clubs_public` / `events_public` calculées par Functions, liste de champs explicite, publication du profil désactivée par défaut (`clubs/{id}.publicProfile.isPublished`), pas d'écriture client. Les règles exigent également que le club associé soit publié avant de lire un événement public. Les triggers relisent les sources en transaction pour éviter les mises à jour hors ordre.
- Backfill idempotent dans `backend/functions/scripts/backfill-public.cjs`, volontairement limité à l'émulateur jusqu'à validation d'une procédure de migration. La synchronisation n'ajoute pas de slug aux clubs existants : migration à concevoir avant ouverture.
- `setClubSlug` vérifie rôle et unicité dans la transaction ; alias conservés indéfiniment (`// DECISION`). Le schéma Zod de `shared/src/index.ts` est copié dans le paquet Functions pour respecter le périmètre de déploiement Firebase ; le build et le lint vérifient leur égalité dans le monorepo.
- Pages publiques club, agenda et événement, métadonnées, JSON-LD, image Open Graph, robots et sitemap ; les données du club et de l'événement sont revérifiées côté serveur. Les résolutions de slug sont mises en cache 60 secondes ; la publication est relue à chaque requête. `noindex` de staging est prévu via `ROOT_DOMAIN`. La vitrine et son texte sont provisoires.
- Les fonctions et tests de règles sont intégrés au job émulateur existant, sans rajouter de runner macOS.

## Vérifications locales

- Functions : build, lint, format et 23 suites / 227 tests Jest réussis.
- Règles Firebase : 3 tests sur émulateurs Firestore et Storage réussis, dont publication, club dépublié, refus d'écritures et visibilité invalide.
- Firestore émulé : deux clubs, événements publics et privés ; backfill exécuté deux fois avec vérification d'absence de réécriture ; droits, alias et concurrence sur un slug réussis (`scripts/test-public-emulator.cjs`).
- Web : lint, typecheck, 14 tests Vitest et build Next réussis. Test HTTP sur Firestore émulé : rendu SSR, événement privé et slug inconnu en 404, alias 308, robots, sitemap et image OG HTTP 200 (`web/scripts/test-public-pages.mjs`).
- Lighthouse mobile, accessibilité clavier, déploiement staging et validation CI distante : **pas encore mesurés / vérifiés**.

## Écarts et reste à faire

- [ ] Un alias utilise `permanentRedirect` de Next.js et renvoie **308** au lieu du **301** demandé. Trouver une solution compatible avec la contrainte de ne pas appeler Firestore depuis le middleware.
- [ ] Migrer et attribuer les slugs aux clubs existants ; préparer une procédure de backfill réelle, paginée, vérifiable et relançable. Ne pas exécuter le script d'émulateur en production.
- [ ] Ajouter tests dédiés à la création de club en collision et au changement de slug, et un parcours complet via les triggers Functions émulés.
- [ ] Vérifier le fonctionnement des domaines personnalisés avec les nouvelles pages publiées : la route phase 1 affiche encore un placeholder.
- [ ] Revalidation à la demande protégée et invalidation ciblée par club ; actuellement cache temporel 60 s. Vérifier aussi le comportement des alias lors d'un changement rapide.
- [ ] Consolider les messages français des nouvelles pages ; finaliser la vitrine et un moyen de contact réel après validation produit.
- [ ] Vérifier les structures des horaires et liens sociaux, les contraintes de taille et de format des champs publiables et la politique de publication ; l'édition web est prévue en phase 4.
- [ ] Tester et mesurer Lighthouse mobile (performance, accessibilité et SEO ≥ 90), l'accessibilité au clavier, le contraste et le `noindex` de staging.
- [ ] Préparer un test HTTP dans la CI et vérifier les résultats de la CI distante ; aucun déploiement n'a été effectué ici.

## Actions manuelles et risques

- [ ] Valider le premier rollout du backend App Hosting staging créé depuis l'audit phase 1, suivant `DEPLOY.md`. Vérifier domaines, DNS, certificats, en-têtes de proxy et domaine autorisé Auth. Déployer seulement après validation des points précédents.
- [ ] Valider le texte marketing, les données publiques proposées, le maintien indéfini des alias et la durée de cache.
- La publication est volontairement opt-in. Aucun résultat nominatif ni inscription publique n'est exposé. Les inscriptions iOS existantes restent inchangées et leur convergence avec la phase 3 reste à arbitrer.
- Firebase Functions utilise Node 24 ; le web Node 26. Le middleware Next 16 est déprécié au profit de `proxy` ; sa migration reste à planifier avec ses tests de routage.
