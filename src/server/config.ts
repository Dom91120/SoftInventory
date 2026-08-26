import { headers } from "next/headers";
import { prisma } from "@/server/db";

/** Lit plusieurs clés de configuration applicative (table app_config). */
export async function getConfigMany(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = "";
  for (const r of rows) out[r.key] = r.value ?? "";
  return out;
}

/** Clé app_config de l'URL publique de l'application (saisie en Administration › Configuration). */
export const APP_URL_KEY = "app.url";

/**
 * Délais de rappel, en jours avant l'échéance (Administration › Messagerie).
 *
 * Lus ICI plutôt que dans chaque service : les rappels par e-mail et la liste
 * « Renouvellements » du tableau de bord doivent parler du même horizon. Ils
 * ont divergé une fois — 60 j en dur dans le tableau de bord contre le réglage
 * pour les e-mails — et l'écran annonçait une fenêtre que le cron n'appliquait
 * pas.
 *
 * Défaut contrat à 90 j (≈ 3 mois) : le délai pour relancer une consultation
 * avant le terme d'un marché.
 *
 * Défaut certificat à 60 j (2 mois) : le temps de faire signer un bon de
 * commande, de le poster en recommandé et d'attendre la délivrance — un
 * certificat ne se renouvelle pas le jour où il expire. Son propre réglage,
 * distinct de celui des marchés : les deux horizons n'ont pas les mêmes
 * contraintes, et les confondre obligerait à choisir le plus long des deux.
 */
export async function seuilsRappel(): Promise<{
  tache: number;
  contrat: number;
  certificat: number;
}> {
  const cfg = await getConfigMany([
    "tache.rappelJoursAvant",
    "contrat.rappelJoursAvant",
    "certificat.rappelJoursAvant",
  ]);
  // Le VIDE est écarté avant tout : `Number("")` vaut zéro, un zéro qui passait
  // toutes les bornes et prenait la place du défaut. Une clé jamais écrite —
  // celle des certificats, tant que personne n'a ouvert l'écran — annonçait
  // ainsi un rappel « 0 jour avant », c'est-à-dire aucun rappel du tout, et le
  // tableau de bord n'affichait rien avant le jour de l'expiration.
  //
  // Zéro SAISI reste une réponse : « prévenir le jour même » se demande, et se
  // distingue d'une case qu'on n'a jamais remplie.
  const lire = (raw: string, defaut: number) => {
    if (raw.trim() === "") return defaut;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 365 ? n : defaut;
  };
  return {
    tache: lire(cfg["tache.rappelJoursAvant"], 14),
    contrat: lire(cfg["contrat.rappelJoursAvant"], 90),
    certificat: lire(cfg["certificat.rappelJoursAvant"], 60),
  };
}

/**
 * URL publique de l'application (pour les liens dans les e-mails). Priorité à la valeur
 * saisie en Administration › Configuration (`app.url`), repli sur les variables
 * d'environnement. Sans slash final ; "" si rien n'est configuré.
 *
 * `request` — la requête à l'origine du courriel, quand il en existe une (un
 * rappel envoyé par le cron n'en a pas). Elle ne sert QU'EN DÉVELOPPEMENT, où
 * la même instance se visite tantôt par `localhost`, tantôt par l'IP du poste
 * sur le réseau : un lien figé sur `localhost` part alors dans un courriel que
 * son destinataire ouvre depuis un AUTRE poste, où il ne mène nulle part.
 *
 * En PRODUCTION l'adresse reste FIGÉE, et c'est délibéré : déduire l'hôte des
 * en-têtes de la requête laisserait un tiers demander une réinitialisation avec
 * un `Host` forgé, et le lien envoyé à la victime pointerait vers son serveur à
 * lui — le jeton lui serait remis en main propre.
 */
export async function getAppUrl(request?: Request): Promise<string> {
  const cfg = (await getConfigMany([APP_URL_KEY]))[APP_URL_KEY]?.trim();
  // `APP_URL` d'abord : c'est l'adresse PUBLIQUE de l'application, celle par
  // laquelle les gens y accèdent. `BETTER_AUTH_URL` ne vient qu'en dernier —
  // elle dit où vit l'API d'authentification, ce qui n'est pas la même question
  // et n'a pas à décider de ce qu'on écrit dans un courriel.
  const fromEnv =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "";
  const figee = (cfg || fromEnv).replace(/\/$/, "");
  // Une adresse CONFIGURÉE fait loi, et c'est ce qu'on veut : un courriel se lit
  // ailleurs que là où il a été demandé. Déduire l'adresse de la requête donnait
  // un lien `localhost` dès que la demande partait du poste serveur — juste pour
  // celui qui l'a cliquée, inutilisable pour celui qui reçoit le message.
  if (figee) return figee;
  // Rien de configuré (installation neuve) : en développement, on déduit
  // l'adresse de la requête en cours plutôt que de n'écrire aucun lien.
  // `headers()` LÈVE hors d'une requête — le cron passe par là sans bruit.
  if (process.env.NODE_ENV !== "production") {
    if (request) {
      try {
        return new URL(request.url).origin;
      } catch {
        /* URL illisible */
      }
    }
    try {
      const h = await headers();
      const host = h.get("host");
      if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
    } catch {
      /* hors requête : rien à déduire */
    }
  }
  return "";
}

/** Existe-t-il une clé `<prefix>…` dont la valeur vaut exactement `value` ? */
export async function isConfigValueUsed(prefix: string, value: string): Promise<boolean> {
  const n = await prisma.appConfig.count({ where: { key: { startsWith: prefix }, value } });
  return n > 0;
}

/** Écrit une clé de configuration applicative. */
export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Écrit plusieurs clés de configuration en une seule transaction. */
export async function setConfigMany(entries: Record<string, string>): Promise<void> {
  const ops = Object.entries(entries).map(([key, value]) =>
    prisma.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    }),
  );
  await prisma.$transaction(ops);
}

/** Supprime une ou plusieurs clés de configuration applicative (no-op si liste vide). */
export async function deleteConfig(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await prisma.appConfig.deleteMany({ where: { key: { in: keys } } });
}
