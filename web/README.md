# Web — développement et démonstration locale

Les pages publiques club, agenda et événement sont rendues côté serveur depuis les projections Firestore. `/admin` utilise le même compte Firebase email/mot de passe et les memberships de l'app iOS; son premier espace comporte les cinq onglets principaux et les règles Firestore existantes restent l'autorité. La vitrine lit son contenu publié dans Firestore et affiche un état indisponible si aucun contenu valide n’est publié. Les paiements, invitations, messagerie et administration des rôles ne sont pas encore portés sur le web; les inscriptions publiques restent en phase 3. Voir [le suivi des phases](../docs/web/SUIVI.md).

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
| Membre | `membre@demo.assodarts.test` |
| Bureau | `bureau@demo.assodarts.test` |
| Admin du club | `admin@demo.assodarts.test` |
| Développeur plateforme | `developpeur@demo.assodarts.test` |
| Administrateur plateforme et membre | `double-role@demo.assodarts.test` |
| Éditeur du site | `site@demo.assodarts.test` |

Le mot de passe temporaire, régénéré à chaque démarrage, est affiché par `./web/demo start`. Ces identifiants fonctionnent uniquement avec `./web/demo` et les émulateurs locaux; ne les réutilisez jamais en staging ou production. Les inscriptions publiques et la page résultats ne sont pas disponibles. Les ports 8080, 9099 ou 3000 occupés par un processus étranger doivent être libérés par son propriétaire : les scripts ne l'arrêtent pas.

Un compte peut être administrateur de la plateforme et membre d'un ou plusieurs clubs. Dans ce cas, l'espace club propose « Administration Assodarts » et l'écran plateforme permet de revenir à l'espace club. Les droits de club restent ceux de chaque adhésion : le rôle plateforme ne confère pas de droits de gestion du club. Les permissions sont relues sur le serveur à l'ouverture de l'espace ; une connexion Firestore est donc nécessaire. L'administration plateforme affiche les clubs en lecture seule par groupes de 50 ; ses autres fonctions restent à réaliser. La gestion du site permet aux éditeurs autorisés de modifier, prévisualiser et publier les contenus de la vitrine (titre, description et sections facultatives). Le changement d'espace n'est pas encore disponible dans l'application iOS.

Le droit d'édition du site est distinct des droits plateforme et club. Pour l'attribuer à un compte existant, un opérateur disposant des droits Firebase peut exécuter `node backend/scripts/grant-site-editor.js --project-id <projet> --email <adresse>`. Il se retire en supprimant le document `site_editors/<uid>` avec les droits d'administration Firebase. Le brouillon est privé ; seul le contenu publié est affiché sur la vitrine. Pour initialiser un environnement vide, un éditeur autorisé doit saisir puis publier ses contenus ; aucune donnée de remplacement n’est injectée en production. Les dix dernières publications effectuées après cette mise à jour sont consultables et peuvent être reprises dans l'éditeur. Une modification concurrente est détectée avant enregistrement : l'éditeur conserve son texte à l'écran pour pouvoir le copier avant de recharger la dernière version.

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
