# Sécurité CI et déploiement — état au 5 novembre 2026

Voir aussi le [suivi général](../SUIVI-CHANTIERS.md) pour les échecs CI constatés et les travaux en attente. Les changements de workflow sont sur `develop` et ne sont pas encore fusionnés dans les branches de livraison.

- `main` et `release-v0.1` exigent une PR et les contrôles Functions, iOS, secrets, Sonar, schémas partagés et émulateurs. `develop` reste accessible en écriture directe. Une règle active applique les mêmes contrôles aux branches `release-*`, actuelles et futures.
- L'environnement GitHub `production` exige une validation par `floriangiral`, est limité à `main` et interdit le contournement administrateur. L'auto-validation reste possible pour permettre à l'unique responsable de déclencher puis approuver lui-même.
- Le déploiement manuel exige un run `Quality` réussi sur le SHA exact. Le staging automatique attend également les tests des règles et schémas ; les PR testent les règles sur un projet d'émulation sans identifiants cloud. La validation distante des règles en dry-run sur PR a été retirée.
- Le build Codemagic est interrompu si `CM_COMMIT` ne correspond pas au SHA transmis par GitHub. Le nom de groupe réellement configuré est `beta-clubs-ext` dans `codemagic.yaml`.
- Les actions restent épinglées ; Dependabot propose les mises à jour. La détection GitHub des secrets et la protection au push sont activées.
- Les tests de règles `backend/functions/rules-tests/` couvrent notamment les membres actifs, inactifs et multi-clubs, l'isolation des clubs, les administrateurs plateforme et les photos. Cette première suite n'est pas exhaustive ; ajouter des tests pour les flux métier et chaque évolution des règles.
- `@firebase/firestore` fixe une ancienne version de gRPC affectée par des avis de sécurité ; une substitution vers 1.14.7 a été appliquée pour la dépendance de test. Les tests d'émulateur passent avec cette substitution ; réévaluer à chaque mise à jour Firebase.

## À terminer avant la production

- [ ] Migrer les déploiements des clés de comptes de service vers Workload Identity Federation/OIDC, en séparant les identités et les rôles staging/production, puis supprimer les anciennes clés après validation. Des comptes et droits techniques ont été configurés pour App Hosting staging ; la migration OIDC et la revue des privilèges restent à faire.
- [ ] Vérifier régulièrement les permissions des collaborateurs et les protections des branches.
- [ ] Confirmer les contrôles web Linux sur le commit courant ; ajouter Playwright et traiter les vulnérabilités avant déploiement.
- [ ] Examiner les alertes GitHub Secret Scanning historiques sur des clés Google et vérifier les restrictions effectives de ces clés, sans les présumer secrètes ni les fermer automatiquement.
- [ ] Traiter les alertes Dependabot ouvertes sur la branche par défaut. Les correctifs sur `develop` n'ont pas été fusionnés dans `main`.
- [ ] Vérifier en staging les droits IAM, le comportement de l'approbation et la correspondance des SHA ; aucun déploiement réel ni simulation de contournement de production n'a été effectué.

## Déclenchement des contrôles

- Le contrôle iOS complet tourne pour les changements `ios-assodarts/**` ou `codemagic.yaml`, et à chaque lancement manuel de `Quality`. Une modification du seul workflow, du web ou du backend ne lance pas le simulateur iOS.
- Si un push sur `develop` est déjà couvert par une PR ouverte portant exactement le même SHA vers une branche suivie, le job macOS du push est sauté ; le job de la PR reste obligatoire. Si GitHub ne peut pas être interrogé, le job macOS est exécuté. Un déploiement manuel de ce SHA exige alors aussi le succès de cette PR.
- Les contrôles web s'exécutent sur Linux lorsque le web ou les schémas partagés changent et que `web/package.json` est présent, ainsi qu'en lancement manuel. Ils couvrent l'installation, l'audit, le lint, le typage, les tests et le build. Le squelette web est désormais versionné ; son job n’a pas encore été prouvé en CI et Playwright n’est pas encore configuré.
- La distribution Codemagic sur un push `release-*` est limitée aux changements iOS ou de sa configuration. Un lancement manuel de `Quality` ne déploie rien par défaut ; l’option `distribute_ios` déclenche explicitement le déploiement staging puis la distribution après succès des contrôles. L’option `deploy_staging` ne déploie que le backend staging. Les déploiements Firebase staging restent indépendants de la présence de changements iOS.
- Les jobs Linux des événements push et PR continuent d'être exécutés : le déploiement manuel requiert un résultat `Quality` de type push pour le SHA exact et les contrôles de sécurité ne sont pas supprimés.
- Les permissions `actions: read` et `pull-requests: read` sont accordées uniquement aux jobs qui les utilisent, pas à tout le workflow.
- Sonar conserve l'analyse de sécurité du schéma `backend/functions/src/shared/club-slug.ts`, mais exclut uniquement cette copie de la mesure de duplication : le bundle Firebase doit être autonome et `check-shared.cjs` impose son identité avec `shared/src/index.ts` à chaque build/lint. La règle est déclarée pour l'analyse automatique et le scanner CI.
