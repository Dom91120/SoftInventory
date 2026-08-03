/**
 * Sauvegarde de la base dans `sauvegardes/`, à lancer AVANT tout seed ou toute
 * migration qui touche aux données :
 *
 *   pnpm db:backup
 *
 * `pg_dump` n'est pas installé sur les postes : on l'exécute donc DANS le
 * conteneur PostgreSQL et on récupère le flux sur la sortie standard, ce qui
 * évite un fichier intermédiaire et fonctionne quelle que soit la taille.
 * Le conteneur se règle par `BACKUP_DB_CONTAINER` (défaut : le conteneur de
 * développement).
 *
 * Format `custom` (-Fc) : compressé, et restaurable table par table —
 *   docker exec -i <conteneur> pg_restore -U <role> -d <base> --clean < fichier.dump
 *
 * ROTATION : seuls les N derniers dumps sont conservés (`BACKUP_KEEP`, 5 par
 * défaut). Elle ne porte QUE sur les fichiers au nom produit par ce script
 * (`<base>-AAAAMMJJ-HHMM.dump`) : un dump renommé à la main — « avant-migration »,
 * « avant-restauration »… — y échappe et se garde indéfiniment. Renommer, c'est
 * donc dire « celui-là, on le garde ».
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const CONTENEUR = process.env.BACKUP_DB_CONTAINER ?? "softinventory-db";
const DOSSIER = path.join(process.cwd(), "sauvegardes");

/** Nombre de dumps automatiques conservés. 0 ou valeur invalide → pas de purge. */
const GARDE = (() => {
  const n = Number(process.env.BACKUP_KEEP ?? 5);
  return Number.isInteger(n) && n > 0 ? n : 0;
})();

/** Rôle et base lus depuis DATABASE_URL — une seule source de vérité. */
function cible(): { role: string; base: string } {
  const brut = process.env.DATABASE_URL;
  if (!brut) throw new Error("DATABASE_URL absente (.env non chargé ?).");
  const u = new URL(brut);
  const base = u.pathname.replace(/^\//, "");
  if (!u.username || !base) throw new Error(`DATABASE_URL incomplète : ${u.protocol}//…/${base}`);
  return { role: decodeURIComponent(u.username), base };
}

/** Horodatage local AAAAMMJJ-HHMM : les fichiers se trient chronologiquement. */
function horodatage(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Purge les dumps automatiques au-delà des `GARDE` plus récents. Le tri par NOM
 * suffit : l'horodatage est en tête, à largeur fixe, donc l'ordre alphabétique
 * est l'ordre chronologique — pas besoin d'interroger le système de fichiers.
 */
async function rotation(base: string): Promise<void> {
  if (GARDE === 0) return;
  const echappee = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`^${echappee}-\\d{8}-\\d{4}\\.dump$`);
  const dumps = (await readdir(DOSSIER)).filter((f) => motif.test(f)).sort();
  const perimes = dumps.slice(0, Math.max(0, dumps.length - GARDE));
  for (const f of perimes) {
    await unlink(path.join(DOSSIER, f));
    console.log(`· purgé : ${f}`);
  }
  if (perimes.length > 0) {
    console.log(`  ${GARDE} sauvegarde(s) automatique(s) conservée(s) (BACKUP_KEEP).`);
  }
}

async function main() {
  const { role, base } = cible();
  await mkdir(DOSSIER, { recursive: true });
  const fichier = path.join(DOSSIER, `${base}-${horodatage()}.dump`);

  const args = ["exec", CONTENEUR, "pg_dump", "-U", role, "-d", base, "-Fc"];
  console.log(`· docker ${args.join(" ")}`);

  const code = await new Promise<number>((resolve, reject) => {
    const p = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    const sortie = createWriteStream(fichier);
    let erreurs = "";
    p.stdout.pipe(sortie);
    p.stderr.on("data", (d) => {
      erreurs += String(d);
    });
    p.on("error", (e) =>
      reject(
        new Error(
          `docker introuvable ou conteneur « ${CONTENEUR} » injoignable : ${e.message}\n` +
            "Le conteneur est-il démarré ? (docker compose -f docker-compose.dev.yml up -d)",
        ),
      ),
    );
    // On attend la fermeture du FICHIER, pas seulement celle du processus :
    // sinon un dump volumineux peut être tronqué.
    p.on("close", (c) =>
      sortie.close(() => (c === 0 ? resolve(0) : reject(new Error(erreurs.trim())))),
    );
  });

  const { size } = await stat(fichier);
  // pg_dump peut sortir en code 0 sans rien écrire si la base est injoignable.
  if (size === 0) {
    await unlink(fichier);
    throw new Error("Dump vide : sauvegarde supprimée, rien n'a été écrit.");
  }
  console.log(
    `✓ Sauvegarde : ${path.relative(process.cwd(), fichier)} (${Math.round(size / 1024)} Ko)`,
  );
  // APRÈS l'écriture réussie : une purge qui précéderait le dump pourrait
  // supprimer d'anciennes sauvegardes puis échouer, laissant moins que prévu.
  await rotation(base);
  return code;
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
