# ESOA — suivi des expéditions et gestion du stock

## Présentation

ESOA est une application web interne de suivi des expéditions. Son interface en français permet de consulter les indicateurs, rechercher et filtrer les envois, modifier leurs statuts et exporter les données.

## Fonctionnalités

- Connexion et déconnexion avec Supabase Auth.
- Tableau des expéditions avec recherche, filtres, tri, sélection groupée et indicateurs de suivi et de frais.
- Création, mise à jour de statut et suppression d’expéditions, seules ou par lot ; export des expéditions en CSV.
- Création d’expéditions avec saisie libre du nom de l’article et journalisation des événements de suivi.
- Thème clair ou sombre, mémorisé dans le navigateur.

## Technologies et organisation

- **Interface :** HTML, Tailwind CSS chargé par CDN et TypeScript côté navigateur.
- **Build et serveur de développement :** Vite 5 ; configuration TypeScript dans `tsconfig.json`.
- **Données et authentification :** Supabase, via `@supabase/supabase-js` chargé par CDN.
- `index.html` contient la vue de suivi des expéditions ; il charge `src/main.ts`.
- `src/main.ts` orchestre l’interface et les actions, `src/ui.ts` gère l’affichage, `src/api.ts` regroupe les accès aux tables Supabase et `src/auth.ts` gère la session.

## Démarrage

1. Installer les dépendances avec `npm install`.
2. Créer un fichier `.env` à la racine avec les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY`.
3. Lancer le serveur local avec `npm run dev`.

Pour générer la version de production, utiliser `npm run build` ; pour la prévisualiser, `npm run preview`.

## Données attendues

Le client utilise les tables Supabase `shipments` et `audit_logs`. Les expéditions comprennent notamment un identifiant, un utilisateur, un article, des frais et un statut. Le nom de l’article est saisi librement lors de la création d’une expédition. L’accès aux tables et aux comptes dépend de la configuration Auth et des politiques d’accès de votre projet Supabase.

## État du dépôt

Le point d’entrée déclaré est la version TypeScript (`src/main.ts`). Des scripts JavaScript plus anciens et des doublons dont le nom se termine par un accent grave sont également présents à la racine ou dans `src/` ; ils ne sont pas le point d’entrée indiqué dans `index.html`. Au moment de la rédaction, `src/inventoryApi.ts` apparaît comme supprimé dans l’état Git local : cette suppression préexistante n’a pas été modifiée.
