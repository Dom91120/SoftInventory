/**
 * Seed d'INSTALLATION — SoftInventory.
 *
 * Crée UN SEUL compte administrateur sur une base vierge (e-mail et mot de
 * passe lus dans l'environnement). Rien d'autre n'est écrit : les référentiels
 * (technologies, criticités, types de tâches, catégories de documents) se
 * saisissent depuis Administration › Référentiels, et les gabarits d'e-mails
 * comme les seuils de rappel ont déjà un repli dans le code — la base n'a
 * besoin d'une ligne que lorsque l'admin personnalise.
 *
 * Idempotent : relançable sans dupliquer ni écraser le profil existant (seul le
 * mot de passe est recalé sur la valeur fournie).
 *
 *   ADMIN_EMAIL=dsi@collectivite.fr ADMIN_PASSWORD='MotDePasse12!' pnpm db:init
 */
// tsx ne charge pas .env de lui-même (contrairement au CLI Prisma via
// prisma.config.ts) : sans cette ligne, DATABASE_URL est absent et le pool pg
// échoue en « client password must be a string ».
import "dotenv/config";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function seedAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans l'environnement " +
        "(ex. dans .env) pour créer le compte administrateur.",
    );
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD doit faire au moins 12 caractères.");
  }

  // Idempotent : crée le compte admin s'il est absent ; sinon ne touche PAS au
  // profil existant (on (re)cale seulement le mot de passe sur la valeur fournie).
  const ctx = await auth.$context;
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      emailVerified: true,
      name: "Admin",
      prenom: "Admin",
      nom: "",
      role: "admin",
    },
  });

  const hash = await ctx.password.hash(ADMIN_PASSWORD);
  const cred = await prisma.account.findFirst({
    where: { userId: admin.id, providerId: "credential" },
  });
  if (cred) {
    await prisma.account.update({ where: { id: cred.id }, data: { password: hash } });
  } else {
    await prisma.account.create({
      data: { accountId: admin.id, providerId: "credential", userId: admin.id, password: hash },
    });
  }
  console.log(`✓ Compte administrateur : ${ADMIN_EMAIL}`);
}

seedAdmin()
  .then(() => console.log("✓ Initialisation terminée (compte admin uniquement)."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
