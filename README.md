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

La migration `20261021000000_track_transit_duration.sql` ajoute l’horodatage du début du statut « En transit ». L’application l’utilise pour signaler les dossiers qui dépassent le seuil choisi (3, 5, 7, 10, 14 ou 30 jours). Exécuter cette migration dans le SQL Editor Supabase avant de déployer la version correspondante de l’application.

## Accès par profil

La migration `20261015000000_scope_shipments_to_profiles.sql` lie chaque compte Supabase à un profil `admin` ou `staff` et applique les droits dans PostgreSQL avec RLS. Le profil Noumena est le seul provisionné par cette migration. Un compte Auth sans ligne correspondante dans `public.profiles` n’a pas accès aux expéditions. Pour réactiver un membre plus tard, créer d’abord son compte dans Supabase Auth, puis ajouter son UUID avec le nom exact `Eric` ou `Mika` et le rôle `staff` dans `public.profiles`. Le déclencheur SQL réattribue alors à ce compte les expéditions et l’historique portant ce nom. La migration doit être exécutée dans le SQL Editor Supabase avant de déployer la version de l’application qui utilise les profils.

## Sauvegardes Supabase

Le workflow `.github/workflows/supabase-backup.yml` crée chaque jour une sauvegarde SQL (rôles, schéma et données) et la conserve comme artefact GitHub pendant 30 jours. Dans GitHub, ajouter le secret `SUPABASE_DB_URL` depuis **Settings → Secrets and variables → Actions** avec la chaîne PostgreSQL de session pooler affichée par Supabase (mot de passe encodé si nécessaire). Le workflow refuse de s’exécuter si le dépôt GitHub est public; ne jamais stocker une sauvegarde de production dans un dépôt public.

Supabase ne fournit pas de sauvegardes automatiques téléchargeables sur le plan Free. Les sauvegardes Pro, Team et Enterprise sont quotidiennes. Le dump de la CLI exclut les schémas gérés `auth` et `storage`; comme les profils ESOA référencent les utilisateurs Auth, il faudra remapper les identifiants de profil et de propriétaire lors d’une restauration vers un nouveau projet. Après avoir ajouté le secret et vérifié que le dépôt est privé, lancer une fois le workflow manuellement depuis l’onglet Actions et vérifier que l’artefact est téléchargeable. Un test de restauration doit se faire sur un projet Supabase séparé, jamais sur la production.

## État du dépôt

Le point d’entrée déclaré est la version TypeScript (`src/main.ts`). Des scripts JavaScript plus anciens et des doublons dont le nom se termine par un accent grave sont également présents à la racine ou dans `src/` ; ils ne sont pas le point d’entrée indiqué dans `index.html`. Au moment de la rédaction, `src/inventoryApi.ts` apparaît comme supprimé dans l’état Git local : cette suppression préexistante n’a pas été modifiée.
