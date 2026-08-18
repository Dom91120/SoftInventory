// tsx ne charge pas .env de lui-même (contrairement au CLI Prisma via
// prisma.config.ts) : sans cette ligne, DATABASE_URL est absente.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Reprise PONCTUELLE du tableau « certifs.xlsx » — 19 certificats électroniques.
 *
 * À n'exécuter qu'une fois. Sans argument il ne fait que DIRE ce qu'il ferait :
 *
 *   pnpm tsx prisma/import-certificats.ts            (lecture seule)
 *   pnpm tsx prisma/import-certificats.ts --write    (écrit, après pnpm db:backup)
 *
 * Il est IDEMPOTENT sur le titulaire : un certificat déjà repris n'est pas
 * dupliqué. Rien n'est écrasé — une fiche existante est laissée telle quelle,
 * la saisie manuelle faisant foi sur une reprise.
 *
 * ── Ce que le fichier d'origine disait, et ce qu'on en a fait ──
 *
 * La colonne « Prochaine Échéance » portait une vraie date, quand la colonne
 * « Période » n'était que du texte. Les deux se recoupent partout à un jour
 * près : l'échéance vaut la fin de validité PLUS UN — c'est le jour où il faut
 * que le remplaçant soit là. On garde donc la fin de validité, et l'échéance a
 * servi d'arbitre pour les quatre lignes où le texte se contredisait :
 *
 *  - Mme FALI      : « au 19/05/209 » → 19/05/2029 (année tronquée à la frappe) ;
 *  - Mme NOLESINI  : « au 25/05/2028 » → 24/02/2028 (l'échéance dit février) ;
 *  - Mme MONTALETANG : début « 06/05/2026 » → 06/05/2025, sans quoi le
 *    certificat durerait deux ans quand tous les autres en durent trois, et son
 *    bon de commande (13/05/2025) serait postérieur d'un an à sa signature ;
 *  - M. JOUENNE    : bon de commande « 19/12/2026 » → 19/12/2025, une commande
 *    ne se signant pas un an après le début de validité qu'elle ouvre.
 *
 * Le fournisseur, la durée et l'imputation n'étaient portés que par la première
 * ligne de chaque bloc (fusion de cellules) : ils sont ici rendus à chaque
 * ligne, une base ne connaissant pas les cellules fusionnées.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ECRIRE = process.argv.includes("--write");

/** Une date de calendrier, sans dérive de fuseau (colonnes @db.Date). */
const j = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Les deux autorités, avec l'adresse que portait le tableau. */
const AUTORITES = {
  CERTINOMIS: {
    nom: "CERTINOMIS",
    adresse: "10 avenue Charles de Gaulle",
    codePostal: "94220",
    ville: "Charenton-le-Pont",
  },
  CHAMBERSIGN: {
    nom: "CHAMBERSIGN",
    adresse: "Place de la Bourse — Service Comptabilité",
    codePostal: "69289",
    ville: "Lyon",
  },
} as const;

type Ligne = {
  titulaire: string;
  fonction: string;
  /** Nom du service tel qu'écrit dans le tableau ; rapproché du référentiel. */
  service?: string;
  autorite: keyof typeof AUTORITES;
  dateDebut: string;
  dateFin: string;
  montantTtc?: number;
  bonCommandeLe?: string;
  /** Certificat de machine : il équipe un serveur plutôt qu'une personne. */
  cachet?: boolean;
};

const LIGNES: Ligne[] = [
  {
    titulaire: "Mme AZZAZ",
    fonction: "Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-05-20",
    dateFin: "2029-05-19",
    bonCommandeLe: "2026-05-20",
  },
  {
    titulaire: "Mme DORFIAC",
    fonction: "Adjointe à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2023-10-18",
    dateFin: "2026-10-17",
    bonCommandeLe: "2026-05-20",
  },
  {
    titulaire: "M. ADJROUD",
    fonction: "Adjoint à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-04-10",
    dateFin: "2029-04-09",
    bonCommandeLe: "2026-04-10",
  },
  {
    titulaire: "M. MOUTON",
    fonction: "Adjoint à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-04-10",
    dateFin: "2029-04-09",
    bonCommandeLe: "2026-04-10",
  },
  {
    // Année tronquée dans le tableau (« 19/05/209 ») : l'échéance tranche.
    titulaire: "Mme FALI",
    fonction: "Adjointe au Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-05-20",
    dateFin: "2029-05-19",
    bonCommandeLe: "2023-06-14",
  },
  {
    // Bon de commande daté 2026 dans le tableau, corrigé en 2025.
    titulaire: "M. JOUENNE",
    fonction: "Adjoint à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2025-12-30",
    dateFin: "2028-12-30",
    montantTtc: 300,
    bonCommandeLe: "2025-12-19",
  },
  {
    titulaire: "Mme GUERTIN",
    fonction: "Adjointe à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-04-20",
    dateFin: "2029-04-19",
    montantTtc: 420,
    bonCommandeLe: "2026-04-20",
  },
  {
    titulaire: "Mme LINARES-CRUZ",
    fonction: "Adjointe à la Maire",
    autorite: "CERTINOMIS",
    dateDebut: "2026-04-20",
    dateFin: "2029-04-19",
    montantTtc: 420,
    bonCommandeLe: "2026-04-20",
  },
  {
    titulaire: "Mme MILLARD-REVENEAU",
    fonction: "Conseillère Municipale Déléguée",
    autorite: "CERTINOMIS",
    dateDebut: "2026-05-12",
    dateFin: "2029-05-11",
    bonCommandeLe: "2026-05-12",
  },
  {
    titulaire: "M. LARFA TAILLANDIER",
    fonction: "DGA",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2026-04-20",
    dateFin: "2029-04-19",
    bonCommandeLe: "2026-04-20",
  },
  {
    titulaire: "M. ROL",
    fonction: "",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2025-10-06",
    dateFin: "2028-10-05",
    montantTtc: 900,
    bonCommandeLe: "2025-07-28",
  },
  {
    titulaire: "M. PALAIN",
    fonction: "",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2025-10-06",
    dateFin: "2028-10-05",
    montantTtc: 900,
    bonCommandeLe: "2025-07-28",
  },
  {
    titulaire: "M. ZYZAK",
    fonction: "Responsable",
    service: "Urbanisme",
    autorite: "CERTINOMIS",
    dateDebut: "2025-06-07",
    dateFin: "2028-06-06",
    bonCommandeLe: "2025-05-13",
  },
  {
    titulaire: "Mme TOMASZEWSKI",
    fonction: "Agent",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2025-03-05",
    dateFin: "2028-03-04",
    montantTtc: 300,
    bonCommandeLe: "2025-03-11",
  },
  {
    // Fin de validité en MAI dans le tableau, en février selon l'échéance.
    titulaire: "Mme NOLESINI",
    fonction: "Agent",
    // « DRH » dans le tableau : le référentiel des services l'appelle
    // « Ressources humaines ».
    service: "Ressources humaines",
    autorite: "CERTINOMIS",
    dateDebut: "2025-02-25",
    dateFin: "2028-02-24",
    montantTtc: 300,
    bonCommandeLe: "2025-03-11",
  },
  {
    titulaire: "Mme WEINGAND",
    fonction: "Responsable",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2026-07-16",
    dateFin: "2029-07-15",
    montantTtc: 390,
    bonCommandeLe: "2026-07-16",
  },
  {
    titulaire: "M. AGOUDJIL",
    fonction: "Coordinateur Commande publique",
    service: "Marchés publics",
    autorite: "CERTINOMIS",
    dateDebut: "2024-07-18",
    dateFin: "2027-07-17",
    montantTtc: 342,
    bonCommandeLe: "2025-07-29",
  },
  {
    // Début 2026 dans le tableau : deux ans de validité seulement, et un bon de
    // commande antérieur d'un an. Ramené à 2025.
    titulaire: "Mme MONTALETANG",
    fonction: "",
    service: "Direction générale",
    autorite: "CERTINOMIS",
    dateDebut: "2025-05-06",
    dateFin: "2028-05-04",
    montantTtc: 420,
    bonCommandeLe: "2025-05-13",
  },
  {
    titulaire: "SERVEUR CLIENT RGS",
    fonction: "",
    service: "DSI",
    autorite: "CHAMBERSIGN",
    dateDebut: "2024-07-18",
    dateFin: "2027-07-17",
    montantTtc: 792,
    bonCommandeLe: "2024-07-29",
    cachet: true,
  },
];

/** Rapprochement souple des noms de service : casse, accents et espaces ignorés. */
const cle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

async function main() {
  const services = await prisma.serviceUtilisateur.findMany({ select: { id: true, nom: true } });
  const parCle = new Map(services.map((s) => [cle(s.nom), s]));
  const dejaLa = new Set(
    (await prisma.certificat.findMany({ select: { titulaire: true } })).map((c) => c.titulaire),
  );

  console.log(ECRIRE ? "· ÉCRITURE" : "· LECTURE SEULE (ajoutez --write pour écrire)");
  console.log(`· ${LIGNES.length} lignes à reprendre, ${dejaLa.size} certificat(s) déjà en base\n`);

  // Les autorités d'abord : chaque certificat pointe dessus.
  const autoriteIds = new Map<string, number>();
  for (const a of Object.values(AUTORITES)) {
    const existant = await prisma.editeur.findUnique({ where: { nom: a.nom } });
    if (existant) {
      autoriteIds.set(a.nom, existant.id);
      console.log(`  société « ${a.nom} » : déjà dans l'annuaire (#${existant.id})`);
      continue;
    }
    if (!ECRIRE) {
      console.log(`  société « ${a.nom} » : À CRÉER — ${a.adresse}, ${a.codePostal} ${a.ville}`);
      continue;
    }
    const cree = await prisma.editeur.create({ data: a });
    autoriteIds.set(a.nom, cree.id);
    console.log(`  société « ${a.nom} » : créée (#${cree.id})`);
  }

  let crees = 0;
  let ignores = 0;
  const servicesInconnus = new Set<string>();

  for (const l of LIGNES) {
    if (dejaLa.has(l.titulaire)) {
      console.log(`  · ${l.titulaire} : déjà présent, laissé tel quel`);
      ignores += 1;
      continue;
    }
    const service = l.service ? parCle.get(cle(l.service)) : undefined;
    if (l.service && !service) servicesInconnus.add(l.service);

    const data = {
      titulaire: l.titulaire,
      fonction: l.fonction,
      fournisseurId: autoriteIds.get(AUTORITES[l.autorite].nom) ?? null,
      serviceId: service?.id ?? null,
      // Un cachet serveur pour la machine de la DSI, une signature pour les
      // personnes : c'est ce que dit la colonne « Identité » du tableau.
      usage: l.cachet ? ("cachet" as const) : ("signature" as const),
      dateDebut: j(l.dateDebut),
      dateFin: j(l.dateFin),
      // « tous les 3 ans » figurait une seule fois, en tête de bloc.
      dureeAnnees: 3,
      montantTtc: l.montantTtc ?? null,
      imputation: "60632",
      bonCommandeLe: l.bonCommandeLe ? j(l.bonCommandeLe) : null,
      notes: "Repris du tableau de suivi des certificats.",
    };

    if (!ECRIRE) {
      console.log(
        `  · ${l.titulaire} — ${l.dateDebut} → ${l.dateFin}` +
          `${service ? ` — service « ${service.nom} »` : l.service ? ` — SERVICE INCONNU « ${l.service} »` : ""}`,
      );
      crees += 1;
      continue;
    }
    await prisma.certificat.create({ data });
    crees += 1;
    console.log(`  · ${l.titulaire} : créé`);
  }

  console.log(
    `\n· ${crees} certificat(s) ${ECRIRE ? "créés" : "à créer"}, ${ignores} laissé(s) de côté`,
  );
  if (servicesInconnus.size > 0) {
    // On ne CRÉE pas de service : le référentiel se tient à la main, et y
    // ajouter une ligne sur la foi d'un tableau reviendrait à décider à la
    // place de celui qui l'administre. Le certificat est simplement rattaché à
    // aucun service, et la liste ci-dessous dit lesquels manquent.
    console.log(
      `· services absents du référentiel, laissés vides : ${[...servicesInconnus].join(", ")}`,
    );
  }
  if (!ECRIRE) console.log("· rien n'a été écrit.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
