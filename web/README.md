# Web — développement et démonstration locale

Les pages publiques club, agenda et événement sont en cours de développement et lisent des projections Firestore. L'espace responsables est encore un placeholder ; les inscriptions et la gestion web ne sont pas encore disponibles. Voir [le suivi des phases](../docs/web/SUIVI.md).

## Installation

Avec Node 26, npm, nvm et Java 21, depuis la racine du dépôt :

```sh
cd web
nvm install
nvm use
npm ci --ignore-scripts
cd ..
```

La première utilisation de la démonstration peut télécharger Firebase CLI 15.35.0 et l'émulateur Firestore. Si Java 21 n'est pas installé dans `/usr/bin`, lancer `JAVA_HOME=/chemin/vers/jdk-21 ./web/demo start` ; le chemin utilisé est mémorisé localement. Les commandes sont prévues pour macOS et Linux avec Bash et `/bin/ps` ; Windows natif n'a pas été vérifié. Les outils sont lancés par leur chemin absolu ; le PATH de l'émulateur ne contient que les dossiers du runtime Node, du JDK configuré et les dossiers système.

## Voir les pages avec des données fictives

```sh
./web/demo start
./web/demo status
./web/demo restart
./web/demo stop
```

La commande démarre l'émulateur Firestore local sur le port 8080, crée un club et des événements fictifs dans le projet `demo-assodarts-web`, puis lance le web sur `127.0.0.1:3000`. Elle n'utilise aucun projet Firebase réel. Les données sont éphémères et réinitialisées au redémarrage de l'émulateur.

- [Vitrine](http://localhost:3000/)
- [Club fictif](http://localhost:3000/?club=club-a)
- [Agenda](http://localhost:3000/agenda?club=club-a)
- [Événement](http://localhost:3000/e/tournoi-decouverte?club=club-a)
- [Espace responsables provisoire](http://admin.localhost:3000/)

Le navigateur peut aussi utiliser `club-a.localhost:3000` si les sous-domaines `.localhost` sont résolus. Le paramètre `?club=club-a` est un mode de secours local et fonctionne aussi sur l'agenda et les détails. L'inscription et les résultats ne sont pas encore disponibles. Le port 8080 ou 3000 occupé par un processus étranger doit être libéré par son propriétaire : les scripts ne l'arrêtent pas.

## Serveur web seul

```sh
./web/dev start
./web/dev status
./web/dev reload
./web/dev restart
./web/dev stop
./web/dev logs
```

`./web/dev` gère uniquement Next.js ; pour voir les données de démonstration et préserver la configuration de l'émulateur lors d'un redémarrage, utiliser `./web/demo`. Les journaux et PID locaux sont dans `web/.local-dev/`, ignoré par Git. En cas d'interruption brutale, vérifier le PID avant de supprimer un éventuel verrou `command.lock` périmé.

## Tester les domaines personnalisés sur émulateur

Avec Java 21, Firebase CLI 15.35.0 et les dépendances web installées, depuis `backend/` :

```sh
firebase emulators:exec --project demo-assodarts-rules --only firestore 'npm --prefix ../web run test:domain'
```

Le test utilise le port 3101 et une correspondance fictive `domains/club.example`. La route de domaine personnalisé affiche encore un placeholder : son intégration aux pages publiques reste à réaliser. Voir [DEPLOY.md](../docs/web/DEPLOY.md).
