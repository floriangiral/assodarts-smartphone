# Suivi des chantiers Assodarts

Dernière vérification : **5 novembre 2026**, sur `develop` au commit `2092e82` avant ce changement documentaire. Ce fichier distingue les constats vérifiés des intentions. Une case cochée représente un résultat vérifié, pas une promesse ; les résultats distants peuvent évoluer.

## Situation générale

| Chantier | État | Référence |
| --- | --- | --- |
| Web multi-club | Phase 1 commencée, aucune des cinq phases terminée. `web/` est local et non versionné. | [Suivi web](web/SUIVI.md) |
| CI et déploiement | Protections GitHub et changements de workflows en place sur `develop` ; CI non verte au dernier contrôle ; nouvelles règles non encore fusionnées vers release/main. | [Sécurité CI](web/SECURITE-CI.md) |
| Sécurité Firebase | Premiers tests de règles sur émulateurs ; migration OIDC, audit IAM et couverture complète encore ouverts. | [Architecture](ARCHITECTURE.md) |
| Structure du dépôt | Audit effectué ; refactorisations proposées, non réalisées. | [Améliorations](#structure-et-maintenance) |
| Instance web locale | Pages de substitution testées dans l'espace de travail local ; ne constitue ni une fonctionnalité métier ni un déploiement. | [Configuration locale](../SETUP.md#web-local-provisoire) |

PR ouverte : [#77, develop vers release-v0.1](https://github.com/floriangiral/assodarts-smartphone/pull/77), en brouillon au dernier contrôle. Aucun merge ni déploiement production n'a été effectué dans ce chantier. Le propriétaire garde ces décisions.

## P0 — rétablir une CI reproductible

- [ ] Corriger `shared/package-lock.json` : les URL `resolved` pointent vers un registre d'entreprise inaccessible aux runners GitHub publics. Régénérer proprement avec le registre npm public, vérifier les intégrités et `npm ci` dans un environnement propre. Le lockfile web local a été corrigé et testé mais reste non versionné ; le lockfile Functions utilise déjà le registre public.
- [ ] Aligner les versions de `github/codeql-action/init` et `analyze` pour iOS et backend. Le run [41991299937](https://github.com/floriangiral/assodarts-smartphone/actions/runs/41991299937) a rapporté une configuration CodeQL 3.37.9 utilisée avec l'analyse 4.38.1 ; le contrôle échoue ensuite faute de SARIF. Épingler les deux actions à des SHA compatibles, puis prouver le résultat sur GitHub.
- [ ] Confirmer le succès des jobs requis sur le commit final et de la PR. Au dernier contrôle du [run 41992766869](https://github.com/floriangiral/assodarts-smartphone/actions/runs/41992766869), les tests de règles et le scan de secrets réussissaient, les jobs Functions et shared échouaient, iOS était encore en cours, et le job web était sauté car `web/` n'est pas versionné. Le run push correspondant était en attente. Ne pas appeler cette CI verte.
- [ ] Revoir les alertes Dependabot de `main` après fusion éventuelle des correctifs : au dernier contrôle, 3 critiques, 2 élevées, 4 moyennes et 2 faibles étaient ouvertes. Ne pas supposer qu'elles décrivent les mêmes versions que `develop`.

## P0 — accès, secrets et déploiements

- [x] Vérification GitHub effectuée : environnement `production` limité à `main`, approbation `floriangiral`, contournement administrateur désactivé ; auto-approbation autorisée pour que le propriétaire puisse déclencher et approuver.
- [x] Protections des branches `main` et `release-*`, scan de secrets GitHub et protection au push configurés. Les changements de workflows sont sur `develop` et n'ont pas encore été fusionnés dans les branches de livraison.
- [ ] Migrer les clés de comptes de service vers Workload Identity Federation/OIDC, avec comptes, restrictions et rôles IAM distincts staging/production. Tester puis retirer les anciennes clés ; aucun changement IAM n'a été réalisé.
- [ ] Vérifier les deux alertes historiques [#1](https://github.com/floriangiral/assodarts-smartphone/security/secret-scanning/1) et [#2](https://github.com/floriangiral/assodarts-smartphone/security/secret-scanning/2) : elles concernent des clés Google dont la validité est inconnue. Vérifier leur nature, leurs restrictions et leur usage avant de décider d'une rotation ou d'une clôture.
- [ ] Étendre les tests Firestore et Storage aux scénarios métier, aux données privées et aux futures projections ; toute modification des règles exige des tests autorisés et refusés sur émulateur. Les premiers tests locaux couvrent l'isolation entre clubs et les photos, pas toute la sécurité.
- [ ] Tester les garde-fous staging et la correspondance de SHA en situation réelle, sans lancer de production. Contrôler le journal Firebase versionné et l'historique avant toute opération de nettoyage.
- [ ] Résoudre l'audit des dépendances web avant déploiement ; `@firebase/firestore` impose une version gRPC signalée vulnérable dans le lockfile local. La substitution utilisée pour les tests Functions doit être réévaluée à chaque mise à jour.

## CI, coûts et environnements

- [x] Sur `develop`, le job iOS est conditionné aux changements iOS/Codemagic ou à un lancement manuel ; le job web prévu utilise Linux lorsqu'il est présent et concerné. Les émulateurs Firebase restent des tests Linux.
- [x] Codemagic ne doit distribuer automatiquement sur `release-*` que pour des changements iOS ; la distribution manuelle est explicite. Une validation manuelle seule ne déploie rien par défaut.
- [ ] Prouver ces conditions sur des runs GitHub : aucune preuve distante finale n'est encore disponible. La PR peut déclencher iOS parce qu'elle contient une modification antérieure de `codemagic.yaml`.
- [ ] Surveiller les coûts et le stockage. Les runners GitHub standards d'un dépôt public sont annoncés gratuits ; Codemagic a sa facturation distincte. Les jobs Linux push et PR sont conservés pour les portes de qualité ; seul le doublon macOS d'un push develop déjà couvert par une PR sur le même SHA est évité.
- [ ] Intégrer le web dans Git, puis vérifier son job Linux, audit npm, lint, typage, tests et build. Ajouter Playwright quand les parcours le permettront. Ne pas prétendre que le web est actuellement couvert par la CI.

## Structure et maintenance

- [ ] Clarifier les contrats des documents entre `backend/types.ts`, Functions, règles et `RemoteModels.swift` ; ajouter des tests de compatibilité sans confondre `authUid` et `memberId`.
- [ ] Produire un package partagé réellement utilisable dans l'archive de déploiement Functions et par le web ; tester ses formats de modules et sa disponibilité en émulation et en CI.
- [ ] Découper progressivement le grand `RemoteRepository.swift` et `AppStore+Backend.swift` par domaine, sous tests, sans modifier les comportements iOS.
- [ ] Consolider les vérifications de rôles dupliquées uniquement après avoir documenté leurs différences et ajouté des tests de droits.
- [ ] Vérifier et mettre à jour les informations utiles des [archives historiques](archives/README-historique.md) avant de les réutiliser ; elles contiennent des instructions dépassées.
- [ ] Étendre les analyses et la couverture à web/shared, mesurer les coûts CI, et maintenir les dépendances les plus récentes **compatibles et testées**. Node 26 est ciblé pour web/shared ; Node 24 pour les Functions à cause de la prise en charge Firebase CLI constatée au 5 novembre 2026. Réévaluer cette limite.
- [ ] Le site, les règles et le déploiement demandent des vérifications de sécurité, accessibilité, mobile et performance appropriées. Aucun score Lighthouse ni déploiement App Hosting n'a encore été prouvé.

## Suivi des demandes et décisions de notre échange

- La demande initiale contient cinq phases et des critères précis : [copie intégrale](web/CAHIER-DES-CHARGES.md), [état et liste opérationnelle](web/SUIVI.md).
- Les versions récentes sont une préférence explicite ; une incompatibilité vérifiée doit être signalée plutôt que forcée silencieusement.
- La sécurité est prioritaire ; le propriétaire contrôle merges et production. Pas de branche de fonctionnalité, rebase ni force-push sur les branches partagées.
- Les conflits avec l'existant doivent être documentés avec preuves ; les choix produit restent ouverts, avec les valeurs par défaut indiquées quand elles existent.
- L'utilisateur a demandé une instance web locale, une CI économe pour le web et les travaux de préproduction, puis cette documentation. L'instance locale a été démarrée et testée ; le dossier n'est pas suivi. La CI iOS a été ajustée, validation distante finale encore attendue.
