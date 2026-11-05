# Plan des pages web

Plan proposé après analyse des écrans iOS et du cahier des charges ; les pages publiques club, agenda et événement sont désormais implémentées et testables localement ; la livraison suit les phases de [SUIVI.md](SUIVI.md). Le contenu commercial et les décisions produit restent à valider. Aucun parcours n'est considéré livré avant ses preuves et son rapport de phase.

## Sources existantes

- Navigation iOS : `ios-assodarts/Assodarts/Views/Club/ClubTabView.swift` ; accueil adapté au rôle : `DashboardView.swift`.
- Agenda et réponses des membres : `EventsView.swift`, création : `NewEventSheet.swift` ; les réponses existantes sont privées et écrites par iOS dans `event_registrations`.
- Rôles `admin`, `board`, `member` : `backend/firestore.rules` et `backend/functions/src/shared/auth.ts`. L'accès administrateur plateforme utilise `platform_admins`.
- Identité visuelle : `ios-assodarts/Assodarts/Utilities/Theme.swift` ; bleu marine, orange, vert, surfaces claires et variantes sombres.
- Les données `clubs` et `events` sont privées. Les pages publiques utilisent des projections dédiées et ne jamais exposer les profils ou inscriptions privées.

## Pages prévues

| Espace | URL | Contenu et étape |
| --- | --- | --- |
| Vitrine | `assodarts.app/` | Présentation minimale en phase 1 ; proposition de valeur, fonctionnalités, essai 14 jours et contact provisoires en phase 2. |
| Club public | `{slug}.assodarts.app/` | Placeholder phase 1 ; présentation publiée, horaires, contact et événements publics phase 2. |
| Club public | `/agenda` | Prochains événements puis passés, phase 2. |
| Club public | `/e/{eventId}` | Détail public phase 2 ; inscription sans compte phase 3. |
| Club public | `/annulation` | Confirmation d'annulation phase 3. |
| Club public | `/resultats` | Seulement si l'audit confirme des données publiables et exploitables. |
| Responsables | `admin.assodarts.app/` | Placeholder connexion phase 1 ; Auth et sélection du club phase 4. |
| Responsables | tableau de bord, événements, inscrits, page publique | Gestion autorisée par les rôles existants, phase 4. |
| Responsables | campagnes et préférences | Campagnes email/SMS et gestion des consentements, phase 5. |

La connexion est centralisée sur le domaine admin. Les URLs racine `/c/{slug}/…` redirigent vers le sous-domaine canonique. Le design est mobile d'abord, accessible au clavier, traduit depuis un fichier de messages et adapté aux écrans larges et au mode sombre.

## Ordre et points de décision

1. Fiabiliser la CI, les hôtes et le socle ; conserver les pages comme placeholders sans métier ni données réelles.
2. Ajouter les projections publiques, les slugs uniques/alias, puis le contenu public et le référencement.
3. Ajouter inscriptions et annulation sans compte. La coexistence avec les réponses iOS existantes est une décision ouverte à documenter avant implémentation.
4. Ajouter l'espace responsable multi-club, après audit de compatibilité des règles iOS.
5. Ajouter rappels et campagnes avec consentements, quotas et prestataire SMS à valider.

À chaque phase : audit ciblé, validation émulateur, tests, build, rapport `RAPPORT-PHASE-N.md`, checklist manuelle et conservation du contrôle des merges et de la production par le propriétaire.
