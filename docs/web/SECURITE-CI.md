# Sécurité CI et déploiement — état au 5 novembre 2026

- `main` et `release-v0.1` exigent une PR et les contrôles Functions, iOS, secrets, Sonar, schémas partagés et émulateurs. `develop` reste accessible en écriture directe. Une règle active applique les mêmes contrôles aux branches `release-*`, actuelles et futures.
- L'environnement GitHub `production` exige une validation par `floriangiral`, est limité à `main` et interdit le contournement administrateur. L'auto-validation reste possible pour permettre à l'unique responsable de déclencher puis approuver lui-même.
- Le déploiement manuel exige un run `Quality` réussi sur le SHA exact. Le staging automatique attend également les tests des règles et schémas ; les PR testent les règles sur un projet d'émulation sans identifiants cloud. La validation distante des règles en dry-run sur PR a été retirée.
- Le build Codemagic est interrompu si `CM_COMMIT` ne correspond pas au SHA transmis par GitHub. Le nom de groupe réellement configuré est `beta-clubs-ext` dans `codemagic.yaml`.
- Les actions restent épinglées ; Dependabot propose les mises à jour. La détection GitHub des secrets et la protection au push sont activées.
- Les tests de règles `backend/functions/rules-tests/` couvrent notamment les membres actifs, inactifs et multi-clubs, l'isolation des clubs, les administrateurs plateforme et les photos. Cette première suite n'est pas exhaustive ; ajouter des tests pour les flux métier et chaque évolution des règles.
- `@firebase/firestore` fixe une ancienne version de gRPC affectée par des avis de sécurité ; une substitution vers 1.14.7 a été appliquée pour la dépendance de test. Les tests d'émulateur passent avec cette substitution ; réévaluer à chaque mise à jour Firebase.

## À terminer avant la production

- [ ] Migrer les déploiements des clés de comptes de service vers Workload Identity Federation/OIDC, en séparant les identités et les rôles staging/production, puis supprimer les anciennes clés après validation. La configuration IAM Google Cloud n'a pas été modifiée.
- [ ] Vérifier régulièrement les permissions des collaborateurs et les protections des branches.
- [ ] Ajouter les jobs web et Playwright lorsque le dossier web sera prêt et commité ; traiter ses vulnérabilités avant déploiement.
- [ ] Examiner les alertes GitHub Secret Scanning historiques sur des clés Google et vérifier les restrictions effectives de ces clés, sans les présumer secrètes ni les fermer automatiquement.
- [ ] Traiter les alertes Dependabot ouvertes sur la branche par défaut. Les correctifs sur `develop` n'ont pas été fusionnés dans `main`.
- [ ] Vérifier en staging les droits IAM, le comportement de l'approbation et la correspondance des SHA ; aucun déploiement réel ni simulation de contournement de production n'a été effectué.
