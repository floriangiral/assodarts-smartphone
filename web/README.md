# Web — développement et démonstration locale

Les pages publiques club, agenda et événement sont rendues côté serveur depuis les projections Firestore. `/admin` utilise le même compte Firebase email/mot de passe et les memberships de l'app iOS; son premier espace comporte les cinq onglets principaux et les règles Firestore existantes restent l'autorité. La vitrine reste provisoire. Les paiements, invitations, messagerie et administration des rôles ne sont pas encore portés sur le web; les inscriptions publiques restent en phase 3. Voir [le suivi des phases](../docs/web/SUIVI.md).

## Installation

Avec Node 26, npm, nvm et Java 21, depuis la racine du dépôt :

```sh
cd web
nvm install
nvm use
npm ci --ignore-scripts
cd ..
```

La première utilisation de la démonstration peut télécharger Firebase CLI 15.35.0 et les émulateurs Auth/Firestore. Si Java 21 n'est pas installé dans `/usr/bin`, lancer `JAVA_HOME=/chemin/vers/jdk-21 ./web/demo start` ; le chemin utilisé est mémorisé localement. Les commandes sont prévues pour macOS et Linux avec Bash et `/bin/ps` ; Windows natif n'a pas été vérifié. Les outils sont lancés par leur chemin absolu ; le PATH de l'émulateur ne contient que les dossiers du runtime Node, du JDK configuré et les dossiers système.

## Voir les pages avec des données fictives

```sh
./web/demo start
./web/demo status
./web/demo restart
./web/demo stop
```

La commande démarre les émulateurs Firestore (`8080`) et Auth (`9099`), crée un club, des membres, des adhésions et des événements fictifs dans le projet `demo-assodarts-web`, puis lance le web sur `127.0.0.1:3000` avec le SDK client connecté aux émulateurs. Elle n'utilise aucun projet Firebase réel. Les données sont éphémères et réinitialisées au redémarrage de l'émulateur.

- [Vitrine](http://localhost:3000/)
- [Club fictif](http://localhost:3000/?club=club-a)
- [Agenda](http://localhost:3000/agenda?club=club-a)
- [Événement](http://localhost:3000/e/tournoi-decouverte?club=club-a)
- [Espace responsables](http://admin.localhost:3000/)

Le navigateur peut aussi utiliser `club-a.localhost:3000` si les sous-domaines `.localhost` sont résolus. Le paramètre `?club=club-a` est un mode de secours local et fonctionne aussi sur l'agenda et les détails. `/admin` utilise les vrais écrans Auth et les règles Firestore, contre des comptes et des données de démonstration locaux :

| Profil | E-mail | Mot de passe |
| --- | --- | --- |
| Membre | `membre@demo.assodarts.test` | `DartsDemo123!` |
| Bureau | `bureau@demo.assodarts.test` | `DartsDemo123!` |
| Admin du club | `admin@demo.assodarts.test` | `DartsDemo123!` |
| Développeur plateforme | `developpeur@demo.assodarts.test` | `DartsDemo123!` |

Ces identifiants fonctionnent uniquement avec `./web/demo` et l'émulateur local; ne les réutilisez jamais en staging ou production. Les inscriptions publiques et la page résultats ne sont pas disponibles. Les ports 8080, 9099 ou 3000 occupés par un processus étranger doivent être libérés par son propriétaire : les scripts ne l'arrêtent pas.

`./web/demo` fournit une clé cliente factice et connecte explicitement le navigateur aux émulateurs; aucune clé réelle n'est nécessaire pour parcourir les rôles.

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
