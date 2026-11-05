# Web — développement local

Le site est un squelette en cours de réalisation. Les pages n'utilisent pas encore les données Firebase ; ne pas déployer cet état.

## Installation

Node 26 et npm sont nécessaires. Avec nvm, depuis la racine du dépôt :

```sh
cd web
nvm install
nvm use
npm ci --ignore-scripts
cd ..
```

À refaire après une modification du fichier de dépendances. Le registre npm public est utilisé par le lockfile. Les commandes ci-dessous peuvent utiliser automatiquement Node 26 installé dans nvm, même si un autre Node est actif dans le shell.

## Commandes depuis la racine du dépôt

```sh
./web/dev start    # démarre le serveur en arrière-plan ou confirme qu'il tourne
./web/dev status   # indique si le serveur est prêt
./web/dev reload   # arrête puis redémarre le serveur
./web/dev restart  # alias de reload
./web/dev stop     # arrête uniquement le serveur lancé par ces commandes
./web/dev logs     # affiche le dernier journal de démarrage
```

Le serveur écoute uniquement sur `127.0.0.1:3000`. Les changements de fichiers sont rechargés automatiquement par Next.js ; utiliser `reload` en cas de changement de configuration ou si nécessaire. Les informations de processus et journaux sont locaux, dans `web/.local-dev/`, ignoré par Git.

Si le port 3000 est déjà pris par un autre processus, `start` et `restart` le signalent sans le tuer. Arrêter ce service par son propre moyen, puis relancer. Si une commande est interrompue brutalement pendant une opération, un verrou `web/.local-dev/command.lock` peut rester : vérifier que son PID ne correspond pas à une commande `web/dev` en cours avant de le supprimer.

## Pages

- http://localhost:3000/ — vitrine provisoire ;
- http://test-club.localhost:3000/ — page provisoire d'un club ;
- http://admin.localhost:3000/ — page provisoire d'administration.

http://localhost:3000/c/test-club redirige vers le sous-domaine du club. Si la résolution de `*.localhost` échoue, ajouter localement les noms nécessaires au fichier hosts, par exemple `127.0.0.1 test-club.localhost admin.localhost`.

`ROOT_DOMAIN` est fixé à `localhost` par le gestionnaire local. Aucun projet ni identifiant Firebase n'est nécessaire pour ces pages ; l'authentification et les émulateurs ne sont pas encore intégrés au parcours web. Ces commandes sont prévues pour macOS et Linux avec Bash et `ps` ; Windows natif n'a pas été vérifié.
