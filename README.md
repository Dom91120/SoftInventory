# SoftInventory

Inventaire des logiciels d'une collectivité territoriale : fiches logiciels
(éditeur, hébergement, criticité, licences, RGPD…), éditeurs et leurs canaux de
support, services utilisateurs, serveurs, pièces jointes (contrats, guides,
délibérations) et tâches récurrentes (mises à jour, renouvellements, purges,
certificats) avec rappels par e-mail.

Application interne (réseau de la collectivité) : deux rôles (administrateur /
lecteur), authentification par comptes locaux et/ou annuaire LDAP – Active
Directory (paramétrable dans l'admin), double authentification TOTP disponible.

## Briques

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 + PostgreSQL ·
Better Auth · Tailwind 4 · zod · Biome · Vitest · nodemailer · ldapts ·
Docker (app + db + cron). Mêmes patterns que le projet frère culturesa-next.

## Développement

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL dédié (softinventory-db)
# .env : DATABASE_URL est déjà réglé sur ce conteneur ; renseigner
# BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (voir .env.example)
pnpm db:migrate     # crée/actualise le schéma
pnpm db:init        # crée le compte administrateur (ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm dev            # http://localhost:3000
```

La base de dev vit dans le conteneur **`softinventory-db`** (PostgreSQL 17, port
hôte **5433**, volume `softinventory-pgdata`) — voir
[docker-compose.dev.yml](docker-compose.dev.yml). Le port 5433 évite le conflit
avec un autre PostgreSQL occupant déjà le 5432.

```bash
docker compose -f docker-compose.dev.yml stop     # arrêter, données conservées
docker compose -f docker-compose.dev.yml down -v  # ⚠ supprime aussi les données
```

Qualité : `pnpm lint` (Biome), `pnpm typecheck`, `pnpm test` (Vitest).

### Sauvegarde

```bash
pnpm db:backup   # dump horodaté dans sauvegardes/
```

Restauration d'un dump :

```bash
docker exec -i softinventory-db pg_restore -U softinventory -d softinventory --clean < sauvegardes/<fichier>.dump
```

`pnpm db:init` est le seul script d'amorçage : il crée le compte administrateur,
et rien d'autre. Les référentiels (technologies, criticités, types de tâches,
catégories de documents) se saisissent depuis Administration › Référentiels ; les
gabarits d'e-mails et les seuils de rappel ont un repli dans le code, la base
n'en garde une ligne que si l'admin les personnalise.

Une base neuve démarre donc avec des listes déroulantes vides — c'est voulu :
aucun contenu n'est poussé dans une base qui contient déjà du travail.

> Si des routes d'API répondent 404 en dev après un `pnpm build`, supprimer le
> cache `.next` puis relancer `pnpm dev` : le manifeste du build de production
> et celui du serveur de dev cohabitent mal dans le même dossier.

## Production (Docker)

```bash
cp .env.example .env   # renseigner secrets, URLs, SMTP
docker compose up -d --build
docker compose run --rm init   # une fois : admin + référentiels
```

- Les migrations s'appliquent automatiquement au démarrage du conteneur app
  (`prisma migrate deploy` dans docker-entrypoint.sh).
- Le conteneur `cron` appelle `/api/cron/*` toutes les 5 minutes ; les horaires
  réels se règlent dans Administration › Tâches planifiées.
- Pièces jointes dans le volume `./attachments` (à inclure dans les sauvegardes,
  avec un dump de la base).
- Servir l'app derrière un reverse proxy TLS ; en HTTP interne pur, poser
  `ALLOW_INSECURE_COOKIES=true` en connaissance de cause.

## Premiers pas

1. Connectez-vous avec le compte admin du seed, changez son mot de passe.
2. Administration › Référentiels : ajustez services utilisateurs, serveurs,
   technologies, criticités, types de tâches, catégories de documents.
3. Administration › Messagerie : SMTP + destinataires par défaut des rappels.
4. Administration › Authentification : annuaire LDAP/AD si souhaité.
5. Créez vos éditeurs puis vos logiciels — licences, tâches et documents se
   gèrent depuis chaque fiche.
