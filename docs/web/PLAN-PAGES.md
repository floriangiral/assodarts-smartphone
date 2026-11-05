# Plan des pages web

Plan et état courant après comparaison avec les écrans iOS. Les pages publiques sont implémentées et le premier portail responsable Auth est disponible en local; la phase 4 reste partielle et aucun rollout staging n'est validé. Voir [SUIVI.md](SUIVI.md) et les [rapports de phase](RAPPORT-PHASE-1.md), [phase 2](RAPPORT-PHASE-2.md) et [phase 4](RAPPORT-PHASE-4.md).

## Sources existantes

- Navigation iOS : `ios-assodarts/Assodarts/Views/Club/ClubTabView.swift` ; accueil adapté au rôle : `DashboardView.swift`.
- Agenda et réponses des membres : `EventsView.swift`, création : `NewEventSheet.swift` ; les réponses existantes sont privées et écrites par iOS dans `event_registrations`.
- Rôles `admin`, `board`, `member` : `backend/firestore.rules` et `backend/functions/src/shared/auth.ts`. L'accès administrateur plateforme utilise `platform_admins`.
- Identité visuelle : `ios-assodarts/Assodarts/Utilities/Theme.swift` ; police système, canvas gris clair, surfaces blanches, bordures grises, orange/vert et marine pour les actions principales. Le site reste en thème clair pour correspondre aux écrans de l'app.
- Les données `clubs` et `events` sont privées. Les pages publiques utilisent des projections dédiées et ne jamais exposer les profils ou inscriptions privées.

## Pages prévues

| Espace | URL | Contenu et étape |
| --- | --- | --- |
| Vitrine | `assodarts.app/` | Implémentée avec copie provisoire et aperçu produit. Offre, essai gratuit et contact commercial restent à valider. |
| Club public | `{slug}.assodarts.app/` | Profil publié, horaires, contact et événements publics depuis les projections. Implémenté en phase 2. |
| Club public | `/agenda` | Événements à venir puis passés; implémenté en phase 2. |
| Club public | `/e/{eventId}` | Détail public et SEO; les inscriptions sans compte sont la phase 3 et ne sont pas disponibles. |
| Club public | `/annulation` | À créer avec les inscriptions en phase 3. |
| Club public | `/resultats` | Non créée : les résultats disponibles contiennent des données nominatives sans projection publique validée. |
| Responsables | `admin.assodarts.app/` | Auth Firebase email/mot de passe et résolution par `authUid`/memberships; en staging la configuration Auth reste à valider. |
| Responsables | Accueil, actualités, événements, membres, tournois | Cinq onglets comme iOS; dashboard par rôle, multi-club, RSVP, création événement/annonce/tournoi et saisie résultat. Phase 4 partielle. |
| Responsables | Paiements, invitations, profils, rôles, messagerie, paramètres | À porter en phase 4; les règles Firestore existantes restent l'autorité. |
| Démo locale | `admin.localhost:3000/` | Auth + Firestore Emulator avec comptes membre, bureau, admin club et développeur plateforme; identifiants dans [web/README.md](../../web/README.md). |
| Responsables | campagnes et préférences | Campagnes email/SMS et gestion des consentements, phase 5. |

La connexion est centralisée sur le domaine admin. Les URLs racine `/c/{slug}/…` redirigent vers le sous-domaine canonique. Le design est mobile d'abord, accessible au clavier, traduit depuis un fichier de messages et adapté aux écrans larges. Les pages privées utilisent le SDK navigateur; elles ne créent pas de cookie ni de session serveur.

## Ordre et points de décision

1. Socle et hôtes disponibles; rollout staging, CI finale, domaines et Lighthouse restent à prouver.
2. Pages publiques et projections disponibles; migration des slugs existants, alias 301, revalidation à la demande et domaine personnalisé restent ouverts.
3. Inscriptions publiques et annulation sans compte non commencées; décider la coexistence avec `event_registrations` iOS avant d'écrire.
4. Portail Auth/rôles commencé; compléter paiements, invitations, édition des rôles et profils, messagerie, exports, QR codes et tests multi-club/A-B.
5. Rappels et campagnes avec consentements, quotas et fournisseur SMS non commencés.

À chaque phase : audit ciblé, validation émulateur, tests, build, rapport `RAPPORT-PHASE-N.md`, checklist manuelle et conservation du contrôle des merges et de la production par le propriétaire.
