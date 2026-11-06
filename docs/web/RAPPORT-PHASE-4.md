# Phase 4 — rapport d'avancement (partiel)

**État : en cours, non validée.** Cette première tranche apporte le socle du portail club, pas la parité complète avec l'application iOS. Aucun déploiement staging ou production n'a été exécuté.

## 1. Réalisations

- Reprise de la police système SwiftUI et des tons clairs de `Theme` : canvas gris clair, surfaces blanches, séparateurs gris, avec accents orange/vert. Les grands aplats navy ont été supprimés; le marine reste réservé aux boutons principaux et petits accents, comme dans iOS.
- `/admin` utilise Firebase Auth email/mot de passe et réinitialisation de mot de passe; résolution du profil par `members.authUid`, puis des memberships actives. Les IDs de membre restent distincts des UID Auth.
- Sélecteur multi-club : préférence locale, puis `defaultClubId`, puis club de rôle le plus élevé. Aucun champ membre n'est modifié.
- Démonstration locale avec les émulateurs Firebase Auth/Firestore et des comptes dédiés membre, bureau, admin club et développeur plateforme. Le seed garde les UID Auth distincts des UUID de membre.
- Navigation cinq onglets comme `ClubTabView` : Accueil, Actualités, Événements, Membres, Tournois. Le dashboard et les actions sont adaptés aux rôles `member`, `board`/`bureau`/`treasurer` et `admin`; `platform_admins` reste séparé.
- Lecture du roster via la callable existante `clubRoster`; lecture des annonces, événements, présences et tournois depuis les collections existantes.
- Réponse à un événement, création d'événement avec visibilité membres/public, publication d'annonce, création de tournoi avec sélection des marqueurs et saisie libre des résultats. Les documents réutilisent les UUID et champs compris par iOS. Les règles Firestore restent inchangées et font autorité côté serveur.
- Documentation locale et App Hosting actualisées. Aucun nouveau rôle, collection ou champ métier n'a été ajouté.

## 2. Vérifications

- Web : `npm run lint`, `npm run typecheck`, `npm test` (24 tests) et `npm run build` réussis après l'ajout des parcours tournoi.
- Contrôle navigateur : connexion réelle à Auth Emulator testée pour les quatre profils; dashboard membre, actions bureau, création admin de tournoi/résultat et écran développeur vérifiés. Les règles Firestore ont autorisé les lectures attendues; aucune règle n'a été modifiée.
- `npm run lint`, `npm run typecheck`, `npm test` (24 tests), `npm run build` et les vérifications syntaxiques des scripts de démo passent.
- Le parcours staging n'est pas testé : les comptes sont locaux à `demo-assodarts-web`, le rollout et les domaines Auth staging restent à valider.
- Le build émet toujours l'avertissement Next.js sur `middleware`, déprécié au profit de `proxy`.

## 3. Écarts et limites

- L'espace ne porte pas encore toutes les fonctions iOS : paiements/cotisations, invitations, profils et changement de rôle, messagerie, notifications, configuration bancaire/abonnement, export, édition/suppression de tournois et suppression de résultats restent à faire.
- L'accès de compte plateforme est reconnu mais la console développeur web n'existe pas.
- Le roster et les données club ne sont pas prouvés en staging; l'accès à `/admin` exige la clé Firebase Web publique au build.

## 4. Décisions appliquées

- Les événements créés sont `members` par défaut, comme dans iOS; un responsable peut choisir `public`.
- **DECISION :** une annonce créée depuis le web est publiée avec `notify: false`; les notifications push ne sont pas envoyées tant qu'un chemin de livraison web n'est pas implémenté.
- Aucun autre modèle de rôles ni système de session serveur n'a été introduit.

## 5. Actions manuelles

- [x] Ajouter les paramètres publics de l'app Web staging à `apphosting.staging.yaml`. Aucun rollout n'a été exécuté.
- [ ] Confirmer dans Firebase Auth que le fournisseur email/mot de passe est activé et autoriser les hôtes admin ainsi que `localhost` pour le développement.
- [x] Ajouter l'émulateur Auth au parcours de démo, créer les comptes membre/bureau/admin/développeur et vérifier leurs vues dans le navigateur.
- [ ] Ajouter des cas automatisés Auth Emulator pour un utilisateur sans rôle et un responsable multi-club; vérifier l'isolation A/B.
- [ ] Vérifier la callable `clubRoster` sur staging, puis faire le rollout staging via la CI après validation des permissions. Aucun déploiement n'a été lancé ici.

## 6. Consolidation et séparation

- Les cinq onglets suivent `ClubTabView`; le mapping de rôles suit `Role.fromRemote` et `canManageClub`/`canManageRoles`.
- Les événements, annonces, présences, tournois et résultats utilisent leurs collections Firestore existantes. Le roster passe par `clubRoster`, car les profils multi-club ne peuvent pas être reconstruits sûrement par une requête client.
- Firebase Auth reste dans le navigateur, sans cookie ni rendu serveur authentifié, conformément à la phase 4.

## 7. Risques et dette

- Sans clé Firebase Web, l'écran de configuration reste affiché; le build seul ne prouve donc pas le parcours connecté.
- Aucun test Playwright Auth/Firestore ni score Lighthouse n'est disponible; aucun rollout staging n'a été fait.
- Les actions directes restent protégées par les règles Firestore et ont été testées en lecture/navigation pour les profils locaux. Les écritures via formulaires et leur refus sur membre simple doivent encore être exercés sur émulateur avant le staging.
- La refonte `middleware` vers `proxy` reste à planifier séparément avec les tests d'hôtes.
