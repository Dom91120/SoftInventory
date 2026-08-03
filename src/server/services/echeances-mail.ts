import { emailButton } from "@/lib/email-theme";
import { greeting } from "@/lib/mail-render";
import { dateCalendaire, joursAvantEcheance, rappelDu, seuilRappel } from "@/lib/taches-core";
import { getAppUrl, getConfigMany } from "@/server/config";
import { prisma } from "@/server/db";
import { sendTemplatedMail } from "@/server/services/mail-send";

/**
 * Cœur de la tâche cron « Rappels d'échéances » :
 *  1. tâches récurrentes actives entrant dans leur fenêtre de rappel ;
 *  2. renouvellements de contrat et fins de contrat sous le seuil global.
 *
 * Un seul rappel par occurrence (marqueurs rappelEnvoyePour / rappelEnvoyeLe,
 * posés APRÈS un envoi accepté, remis à zéro quand la date change). Envois en
 * mode « queue » : un SMTP en panne alimente failed_mails au lieu de faire
 * échouer la tâche entière.
 */

const fmtDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

async function destinatairesDefaut(): Promise<string[]> {
  const cfg = await getConfigMany(["tache.destinatairesDefaut"]);
  return (cfg["tache.destinatairesDefaut"] ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

async function seuils(): Promise<{ tache: number; contrat: number }> {
  const cfg = await getConfigMany(["tache.rappelJoursAvant", "contrat.rappelJoursAvant"]);
  const lire = (raw: string, defaut: number) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 365 ? n : defaut;
  };
  return {
    tache: lire(cfg["tache.rappelJoursAvant"], 14),
    contrat: lire(cfg["contrat.rappelJoursAvant"], 60),
  };
}

export async function envoyerRappelsEcheances(): Promise<{
  rappelsTaches: number;
  rappelsContrats: number;
}> {
  const aujourdhui = dateCalendaire(new Date());
  const { tache: seuilTache, contrat: seuilContrat } = await seuils();
  const fallback = await destinatairesDefaut();
  const appUrl = await getAppUrl();

  let rappelsTaches = 0;
  let rappelsContrats = 0;

  // ── 1. Tâches récurrentes ──
  // Présélection large en SQL (échéance sous le seuil MAXIMAL possible, 365 j),
  // décision fine en mémoire via rappelDu (seuil par tâche + anti-doublon).
  const fenetreMax = new Date(aujourdhui.getTime() + 365 * 86_400_000);
  const taches = await prisma.tacheRecurrente.findMany({
    where: { statut: "active", prochaineEcheance: { lte: fenetreMax } },
    include: {
      logiciel: { select: { id: true, nom: true } },
      assigne: { select: { email: true, prenom: true } },
    },
  });

  for (const t of taches) {
    if (
      !rappelDu(t.prochaineEcheance, t.rappelEnvoyePour, t.rappelJoursAvant, seuilTache, aujourdhui)
    ) {
      continue;
    }
    // Fenêtre réelle : rappelDu a déjà appliqué le seuil effectif ; on écarte
    // simplement ce qui est à plus d'un an (présélection).
    if (
      joursAvantEcheance(t.prochaineEcheance, aujourdhui) >
      seuilRappel(t.rappelJoursAvant, seuilTache)
    ) {
      continue;
    }
    const destinataires = t.assigne?.email ? [t.assigne.email] : fallback;
    if (destinataires.length === 0) continue; // personne à prévenir : on réessaiera quand la config sera posée

    const enRetard = t.prochaineEcheance.getTime() < aujourdhui.getTime();
    const url = appUrl ? `${appUrl}/logiciels/${t.logiciel.id}?onglet=taches` : "";
    const vars = {
      salutation: greeting(t.assigne?.prenom ?? ""),
      titre: t.titre,
      logiciel: t.logiciel.nom,
      echeance: fmtDate.format(t.prochaineEcheance),
      description: t.description,
      assigne: t.assigne?.email ?? t.assigneLibre,
      url,
    };
    let auMoinsUnEnvoi = false;
    for (const to of destinataires) {
      const res = await sendTemplatedMail({
        to,
        kind: enRetard ? "tache_retard" : "tache_rappel",
        vars,
        rawVars: url ? { bouton: emailButton(url, "Ouvrir la tâche") } : {},
        mode: "queue",
      });
      // `queued` compte comme parti : l'e-mail sera renvoyé depuis la file —
      // re-marquer l'occurrence éviterait un doublon au prochain passage.
      if (res.ok || res.queued) auMoinsUnEnvoi = true;
    }
    if (auMoinsUnEnvoi) {
      await prisma.tacheRecurrente.update({
        where: { id: t.id },
        data: { rappelEnvoyePour: t.prochaineEcheance },
      });
      rappelsTaches += 1;
    }
  }

  // ── 2. Renouvellements de contrat et fins de contrat des fiches ──
  if (fallback.length > 0) {
    const fenetreContrat = new Date(aujourdhui.getTime() + seuilContrat * 86_400_000);

    // L'anti-doublon (rappelEnvoyeLe === dateRenouvellement) se tranche en
    // mémoire : la comparaison colonne-à-colonne en SQL n'apporterait rien sur
    // ces volumes.
    // L'échéance vit sur la LIGNE de contrat, pas sur le marché : un même
    // marché peut couvrir plusieurs postes aux termes distincts, et chacun
    // mérite son rappel.
    const lignes = await prisma.pieceContrat.findMany({
      where: { dateRenouvellement: { not: null, lte: fenetreContrat } },
      include: {
        contrat: {
          select: {
            libelle: true,
            referenceMarche: true,
            logiciel: { select: { id: true, nom: true } },
          },
        },
      },
    });
    for (const l of lignes) {
      if (!l.dateRenouvellement) continue;
      if (l.rappelEnvoyeLe?.getTime() === l.dateRenouvellement.getTime()) continue;
      const marche = l.contrat;
      const url = appUrl ? `${appUrl}/logiciels/${marche.logiciel.id}?onglet=contrats` : "";
      // C'est une PIÈCE qui arrive à échéance, mais seul le marché la nomme :
      // une pièce ne porte plus de libellé propre.
      const nomMarche = marche.libelle || marche.referenceMarche || "sans libellé";
      const objet = `Une pièce du contrat « ${nomMarche} »`;
      let auMoinsUnEnvoi = false;
      for (const to of fallback) {
        const res = await sendTemplatedMail({
          to,
          kind: "contrat_rappel",
          vars: {
            salutation: greeting(""),
            objet,
            logiciel: marche.logiciel.nom,
            echeance: fmtDate.format(l.dateRenouvellement),
            details: marche.referenceMarche
              ? `Référence marché/contrat : ${marche.referenceMarche}.`
              : "",
            url,
          },
          rawVars: url ? { bouton: emailButton(url, "Ouvrir les contrats") } : {},
          mode: "queue",
        });
        if (res.ok || res.queued) auMoinsUnEnvoi = true;
      }
      if (auMoinsUnEnvoi) {
        await prisma.pieceContrat.update({
          where: { id: l.id },
          data: { rappelEnvoyeLe: l.dateRenouvellement },
        });
        rappelsContrats += 1;
      }
    }

    const logiciels = await prisma.logiciel.findMany({
      where: { finContratLe: { not: null, lte: fenetreContrat } },
      select: { id: true, nom: true, finContratLe: true, rappelEnvoyeLe: true },
    });
    for (const l of logiciels) {
      if (!l.finContratLe) continue;
      if (l.rappelEnvoyeLe?.getTime() === l.finContratLe.getTime()) continue;
      const url = appUrl ? `${appUrl}/logiciels/${l.id}` : "";
      let auMoinsUnEnvoi = false;
      for (const to of fallback) {
        const res = await sendTemplatedMail({
          to,
          kind: "contrat_rappel",
          vars: {
            salutation: greeting(""),
            objet: "Le contrat / marché",
            logiciel: l.nom,
            echeance: fmtDate.format(l.finContratLe),
            details: "",
            url,
          },
          rawVars: url ? { bouton: emailButton(url, "Ouvrir la fiche") } : {},
          mode: "queue",
        });
        if (res.ok || res.queued) auMoinsUnEnvoi = true;
      }
      if (auMoinsUnEnvoi) {
        await prisma.logiciel.update({
          where: { id: l.id },
          data: { rappelEnvoyeLe: l.finContratLe },
        });
        rappelsContrats += 1;
      }
    }
  }

  return { rappelsTaches, rappelsContrats };
}

export function summarizeEcheances(r: { rappelsTaches: number; rappelsContrats: number }): string {
  return `${r.rappelsTaches} rappel(s) de tâche, ${r.rappelsContrats} rappel(s) de contrat`;
}
