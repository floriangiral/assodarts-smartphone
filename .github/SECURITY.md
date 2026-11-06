# Politique de sécurité

## Signalement

Ne publiez pas de vulnérabilité ni de données personnelles dans une issue publique. Utilisez le signalement privé de vulnérabilités GitHub s'il est disponible, ou contactez le propriétaire par un canal privé. Décrivez les conditions de reproduction et l'impact sans divulguer de secret.

## Périmètre et contrôles

`main` est la branche de référence pour les correctifs de sécurité ; les changements transitent par `develop` et les branches de livraison selon le processus documenté. Le workflow `Quality` vérifie notamment Functions, schémas partagés, règles Firestore et Storage sur émulateurs, scan de secrets et analyse statique ; iOS et web s'exécutent selon les chemins modifiés. La présence d'un workflow ne prouve pas que le dernier run a réussi : consulter les résultats GitHub.

La production est réservée à un déploiement manuel validé par le propriétaire dans l'environnement GitHub `production`. Les protections configurées et leurs limites sont décrites dans [SECURITE-CI.md](../docs/web/SECURITE-CI.md). La migration des clés de service vers OIDC est encore ouverte.

Les clés API des applications Firebase sont des identifiants clients publics et doivent être correctement restreintes. Les clés Stripe, Resend et SMS, les jetons, les comptes de service et les clés de signature sont des secrets : ne pas les committer ni les intégrer au client. Les secrets serveur sont gérés par Secret Manager ou les environnements GitHub selon leur usage actuel.
