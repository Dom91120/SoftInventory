# SoftInventory

Inventaire des logiciels d'une collectivité territoriale : fiches logiciels
(éditeur, hébergement, criticité, licences, RGPD…), éditeurs avec leurs canaux
de support et leurs contacts commercial et administratif, services
utilisateurs, serveurs, marchés et leurs pièces contractuelles,
devis de mise en concurrence, pièces jointes (guides, délibérations) et tâches
récurrentes (mises à jour, renouvellements, purges, certificats) avec rappels par
e-mail.

Application interne (réseau de la collectivité) : deux rôles (administrateur /
lecteur), authentification par comptes locaux et/ou annuaire LDAP – Active
Directory (paramétrable dans l'admin), double authentification TOTP disponible.

## La fiche logiciel

Tout se rattache au logiciel, via huit onglets : **Synthèse**, **Support**
(canaux hérités de l'éditeur ou propres au logiciel), **Liaisons** (dépendances
entre logiciels, serveurs, services utilisateurs), **Contrats/Marchés**,
**Devis**, **Tâches**, **Documents** et **RGPD**.

**Les coordonnées de l'éditeur ne se saisissent qu'une fois**, sur sa fiche :
le support (portail de tickets, mail, téléphone, horaires) et, sous
**Divers**, les contacts hors incident — téléphone et mail du commercial pour
l'offre et le renouvellement, de l'administratif pour la facturation, plus un
champ libre d'observations. L'onglet Support du logiciel les remonte en deux
cartes, en lecture seule : la question « qui j'appelle ? » se pose devant le
logiciel, mais la réponse vaut pour tous les logiciels du même éditeur —
la recopier fiche par fiche garantirait des numéros divergents.

**C'est le marché qui engage.** Il porte sa référence, son fournisseur
(l'éditeur du logiciel par défaut, une société nommée quand c'est un
revendeur), sa période — affichée « du 01/01/2023 au 31/12/2026 » —, son
montant annuel et, quand l'acte en fixe un, son montant maximum. Ce plafond
ne contraint pas le montant annuel : il porte souvent sur la durée entière.
Seul le montant annuel entre dans le coût du parc — un plafond n'est pas une
dépense.

Ses **pièces** ne décrivent qu'elles-mêmes : un fichier, la catégorie de ce
fichier, et la date du document (signature, notification). Elles ne chiffrent
rien et ne déclenchent rien. Les marchés se lisent du plus récent au plus
ancien.

L'échéance surveillée est donc la **date de fin du marché**, et elle seule.
Un rappel part 3 mois avant (délai réglable en Administration › Messagerie),
une fois par échéance ; dans cette même fenêtre, une pastille **À renouveler**
paraît sur le marché — l'écran et l'e-mail lisent le même réglage, ils ne
peuvent pas se contredire.

Jamais de rappel rétroactif : un marché déjà échu se constate — la pastille
dit alors **Terminé** — il ne se rappelle pas. On peut ainsi saisir d'anciens
marchés pour l'historique sans déclencher d'envoi.

Les devis racontent l'avant-contrat : ils se groupent par consultation (un
objet, une date), avec le montant de chaque fournisseur et celui qui a été
retenu — la mise en concurrence dont le marché est issu.

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

> **Après toute migration, arrêter `pnpm dev` avant `pnpm db:generate`.** Sous
> Windows, le serveur verrouille les fichiers du client généré : la génération
> paraît réussir mais `pnpm typecheck` continue d'ignorer les nouveaux champs,
> et Turbopack sert un bundle à cheval sur l'ancien client. Le symptôme est
> déroutant — une écriture échoue en `Unknown argument` sur un champ **ancien**
> et non sur celui qu'on vient d'ajouter. Arrêter le serveur, `pnpm
> db:generate`, supprimer `.next` au besoin, relancer.

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
   technologies, criticités, types de tâches, catégories de documents. Ces
   dernières avant tout dépôt de fichier : aucune liste n'offre de choix vide,
   un document a toujours une catégorie.
3. Administration › Messagerie : SMTP, destinataires par défaut des rappels et
   délais (3 mois avant la fin d'un marché, 14 jours avant une tâche).
4. Administration › Authentification : annuaire LDAP/AD si souhaité.
5. Créez vos éditeurs puis vos logiciels — marchés, devis, tâches et documents
   se gèrent depuis chaque fiche.
