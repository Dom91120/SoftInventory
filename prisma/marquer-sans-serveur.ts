// tsx ne charge pas .env de lui-même (contrairement au CLI Prisma via
// prisma.config.ts) : sans cette ligne, DATABASE_URL est absente.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Reprise PONCTUELLE du marqueur « aucun serveur » sur les fiches où la
 * question ne se pose pas. Sans argument il ne fait que DIRE ce qu'il ferait :
 *
 *   pnpm tsx prisma/marquer-sans-serveur.ts            (lecture seule)
 *   pnpm tsx prisma/marquer-sans-serveur.ts --write    (écrit, après pnpm db:backup)
 *
 * ── Ce qu'il coche, et pourquoi ──
 *
 * DEUX règles, et rien d'autre :
 *
 *  - hébergement SaaS : l'application tourne chez l'éditeur, il n'y a aucune
 *    machine du parc à déclarer ;
 *  - technologie de POSTE (voir `TECHNOS_POSTE`) : elle s'installe sur les
 *    postes des agents, pas sur un serveur.
 *
 * L'hébergement « hybride » est LAISSÉ DE CÔTÉ, quoi qu'en dise sa technologie :
 * il dit qu'une part tourne chez nous, donc qu'un serveur est attendu. Une
 * fiche déjà cochée ou qui porte une installation l'est aussi — le script ne
 * défait rien et ne contredit personne.
 *
 * La technologie n'est renseignée que sur trois fiches sur quatre : les fiches
 * on premise sans technologie ne sont donc PAS cochées, faute de savoir. Elles
 * restent dans la jauge, ce qui est le bon défaut — mieux vaut une jauge un peu
 * sévère qu'un marqueur posé sur une supposition.
 *
 * IDEMPOTENT : relancé, il ne trouve plus rien à faire.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ECRIRE = process.argv.includes("--write");

/**
 * Les technologies qui désignent une installation sur le POSTE de l'agent.
 * Rapprochées par LIBELLÉ : le référentiel est saisi par l'admin, qui peut
 * l'avoir renommé — dans ce cas la fiche n'est simplement pas cochée, et le
 * script le dit plutôt que de deviner.
 */
const TECHNOS_POSTE = ["Poste de travail", "Mono/multi poste", "Mobile"];

async function main() {
  const logiciels = await prisma.logiciel.findMany({
    select: {
      id: true,
      nom: true,
      hebergement: true,
      sansServeur: true,
      technologie: { select: { label: true } },
      _count: { select: { serveurs: true } },
    },
    orderBy: { nom: "asc" },
  });

  /** Les libellés de `TECHNOS_POSTE` que le référentiel ne porte pas (ou plus). */
  const connus = new Set(logiciels.map((l) => l.technologie?.label).filter(Boolean));
  const absents = TECHNOS_POSTE.filter((t) => !connus.has(t));

  const aCocher: Array<{ id: number; nom: string; motif: string }> = [];
  let dejaCoches = 0;
  let avecInstallation = 0;

  for (const l of logiciels) {
    if (l.sansServeur) {
      dejaCoches += 1;
      continue;
    }
    // Une installation déclarée est une réponse : le marqueur la contredirait,
    // et le service la refuserait de toute façon.
    if (l._count.serveurs > 0) {
      avecInstallation += 1;
      continue;
    }
    if (l.hebergement === "saas") {
      aCocher.push({ id: l.id, nom: l.nom, motif: "SaaS" });
      continue;
    }
    // « hybride » dit qu'une part tourne chez nous : un serveur y est attendu.
    if (l.hebergement === "hybride") continue;
    const techno = l.technologie?.label;
    if (techno && TECHNOS_POSTE.includes(techno)) {
      aCocher.push({ id: l.id, nom: l.nom, motif: techno });
    }
  }

  console.log(
    `· ${logiciels.length} fiches lues — ${dejaCoches} déjà marquée(s), ${avecInstallation} avec au moins une installation.\n`,
  );

  if (aCocher.length === 0) {
    console.log("· rien à cocher.");
    return;
  }

  const large = Math.max(...aCocher.map((c) => c.nom.length));
  for (const c of aCocher) {
    console.log(`  · ${c.nom.padEnd(large)}  ${c.motif}`);
  }

  console.log(`\n· ${aCocher.length} fiche(s) ${ECRIRE ? "cochées" : "à cocher"}`);

  if (absents.length > 0) {
    // Le référentiel a pu être renommé depuis l'écriture de ce script : mieux
    // vaut le dire que de laisser croire à un parc parfaitement couvert.
    console.log(
      `· technologies attendues et absentes du référentiel, donc jamais rapprochées : ${absents.join(", ")}`,
    );
  }

  if (!ECRIRE) {
    console.log("· rien n'a été écrit — relancez avec --write, après pnpm db:backup.");
    return;
  }

  const { count } = await prisma.logiciel.updateMany({
    where: { id: { in: aCocher.map((c) => c.id) } },
    data: { sansServeur: true },
  });
  console.log(`· ${count} fiche(s) écrite(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
