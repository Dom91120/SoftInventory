// tsx ne charge pas .env de lui-même (contrairement au CLI Prisma via
// prisma.config.ts) : sans cette ligne, DATABASE_URL est absente.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Reprise PONCTUELLE : la civilité sort du champ « titulaire » pour rejoindre
 * sa colonne. Sans argument il ne fait que DIRE ce qu'il ferait :
 *
 *   pnpm tsx prisma/extraire-civilites.ts            (lecture seule)
 *   pnpm tsx prisma/extraire-civilites.ts --write    (écrit, après pnpm db:backup)
 *
 * Le préfixe est reconnu EN TÊTE du titulaire, et seulement là : « M. »,
 * « Mme », « Mr », « Madame », « Monsieur », avec ou sans point, insensible à
 * la casse. Ce qui suit est conservé tel quel, espaces en trop retirés — les
 * prénoms composés (« MILLARD REVENEAU Marie-Christine ») ne sont pas touchés.
 *
 * Ce qu'il NE FAIT PAS, et c'est voulu : deviner la civilité d'après le
 * prénom. Un certificat de machine (« SERVEUR CLIENT RGS ») n'a personne à
 * nommer, et un titulaire sans préfixe reste sans civilité — mieux vaut un
 * champ vide qu'un « M. » présumé sur une fiche qui engage une signature.
 *
 * IDEMPOTENT : relancé, il ne trouve plus de préfixe à retirer. Une fiche dont
 * la civilité est déjà renseignée est laissée de côté, quoi que porte son nom.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ECRIRE = process.argv.includes("--write");

/**
 * Les formes rencontrées, et celles qu'on peut rencontrer. L'ordre compte :
 * « Monsieur » avant « M », sans quoi le préfixe court mordrait sur le long.
 */
const PREFIXES: Array<{ motif: RegExp; civilite: "m" | "mme" }> = [
  { motif: /^madame\b\.?\s*/i, civilite: "mme" },
  { motif: /^monsieur\b\.?\s*/i, civilite: "m" },
  { motif: /^mme\b\.?\s*/i, civilite: "mme" },
  { motif: /^mlle\b\.?\s*/i, civilite: "mme" },
  { motif: /^mr\b\.?\s*/i, civilite: "m" },
  { motif: /^m\.\s*/i, civilite: "m" },
];

/** Le préfixe trouvé en tête, et le nom qui reste — ou null s'il n'y en a pas. */
function separer(titulaire: string): { civilite: "m" | "mme"; nom: string } | null {
  for (const { motif, civilite } of PREFIXES) {
    if (motif.test(titulaire)) {
      const nom = titulaire.replace(motif, "").trim();
      // Un titulaire qui ne serait QUE sa civilité laisserait une fiche sans
      // nom : on ne touche pas, et la ligne se voit dans le compte des ignorés.
      if (nom === "") return null;
      return { civilite, nom };
    }
  }
  return null;
}

async function main() {
  const certificats = await prisma.certificat.findMany({
    select: { id: true, civilite: true, titulaire: true },
    orderBy: { titulaire: "asc" },
  });

  const aReprendre: Array<{ id: number; avant: string; civilite: "m" | "mme"; nom: string }> = [];
  const laissees: string[] = [];

  for (const c of certificats) {
    // Déjà renseignée : la saisie manuelle fait foi sur une reprise.
    if (c.civilite !== null) continue;
    const separe = separer(c.titulaire);
    if (!separe) {
      laissees.push(c.titulaire);
      continue;
    }
    aReprendre.push({ id: c.id, avant: c.titulaire, civilite: separe.civilite, nom: separe.nom });
  }

  console.log(`· ${certificats.length} certificat(s) lus\n`);

  if (aReprendre.length > 0) {
    const large = Math.max(...aReprendre.map((c) => c.avant.length));
    for (const c of aReprendre) {
      const civ = c.civilite === "mme" ? "Mme" : "M.";
      console.log(`  · ${c.avant.padEnd(large)}  →  [${civ.padEnd(3)}] ${c.nom}`);
    }
    console.log("");
  }

  console.log(`· ${aReprendre.length} titulaire(s) ${ECRIRE ? "repris" : "à reprendre"}`);
  if (laissees.length > 0) {
    // Sans civilité en tête : machine, ou nom déjà nu. Rien à faire, mais on
    // les nomme — c'est ce qui permet de vérifier qu'aucune n'a été manquée.
    console.log(`· ${laissees.length} sans civilité en tête, laissé(s) tel(s) quel(s) :`);
    for (const t of laissees) console.log(`    ${t}`);
  }

  if (!ECRIRE) {
    console.log("\n· rien n'a été écrit — relancez avec --write, après pnpm db:backup.");
    return;
  }

  // EN SÉQUENCE et non en updateMany : chaque ligne reçoit SON nom tondu, il
  // n'y a pas de valeur commune à poser.
  for (const c of aReprendre) {
    await prisma.certificat.update({
      where: { id: c.id },
      data: { civilite: c.civilite, titulaire: c.nom },
    });
  }
  console.log(`\n· ${aReprendre.length} fiche(s) écrite(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
