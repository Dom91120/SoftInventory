import { emailButton } from "@/lib/email-theme";
import { greeting } from "@/lib/mail-render";
import { dateCalendaire, joursAvantEcheance, rappelDu, seuilRappel } from "@/lib/taches-core";
import { getAppUrl, getConfigMany, seuilsRappel } from "@/server/config";
import { prisma } from "@/server/db";
import { sendTemplatedMail } from "@/server/services/mail-send";

/**
 * Cœur de la tâche cron « Rappels d'échéances » :
 *  1. tâches récurrentes actives entrant dans leur fenêtre de rappel ;
 *  2. renouvellements de contrat et fins de contrat sous le seuil global ;
 *  3. certificats électroniques arrivant à expiration, sous leur propre seuil.
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

export async function envoyerRappelsEcheances(): Promise<{
  rappelsTaches: number;
  rappelsContrats: number;
  rappelsCertificats: number;
}> {
  const aujourdhui = dateCalendaire(new Date());
  const {
    tache: seuilTache,
    contrat: seuilContrat,
    certificat: seuilCertificat,
  } = await seuilsRappel();
  const fallback = await destinatairesDefaut();
  const appUrl = await getAppUrl();

  let rappelsTaches = 0;
  let rappelsContrats = 0;
  let rappelsCertificats = 0;

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

    // L'anti-doublon (rappelEnvoyeLe === dateFin) se tranche en mémoire : la
    // comparaison colonne-à-colonne en SQL n'apporterait rien sur ces volumes.
    // L'échéance vit sur le MARCHÉ, pas sur ses pièces : celles-ci ne portent
    // plus qu'une date de document, presque toujours passée — les surveiller
    // enverrait un rappel pour chacune dès le premier passage.
    // Borne BASSE autant que haute : un marché déjà échu ne se rappelle plus,
    // il se constate. Sans elle, chaque marché ancien saisi pour l'historique
    // déclencherait un rappel rétroactif dès le passage suivant du cron.
    const marches = await prisma.contrat.findMany({
      where: { dateFin: { gte: aujourdhui, lte: fenetreContrat } },
      select: {
        id: true,
        libelle: true,
        referenceMarche: true,
        dateFin: true,
        rappelEnvoyeLe: true,
        logiciels: { select: { logiciel: { select: { nom: true } } } },
      },
    });
    for (const m of marches) {
      if (!m.dateFin) continue;
      if (m.rappelEnvoyeLe?.getTime() === m.dateFin.getTime()) continue;
      // Le lien mène à la FICHE DU MARCHÉ : il en couvre parfois plusieurs, et
      // aucun logiciel ne peut prétendre le représenter.
      const url = appUrl ? `${appUrl}/contrats/${m.id}` : "";
      const nomMarche = m.libelle || m.referenceMarche || "sans libellé";
      const couverts = m.logiciels.map((l) => l.logiciel.nom).join(", ");
      const objet = `Le contrat « ${nomMarche} »`;
      let auMoinsUnEnvoi = false;
      for (const to of fallback) {
        const res = await sendTemplatedMail({
          to,
          kind: "contrat_rappel",
          vars: {
            salutation: greeting(""),
            objet,
            logiciel: couverts || "aucun logiciel rattaché",
            echeance: fmtDate.format(m.dateFin),
            details: m.referenceMarche ? `Référence marché/contrat : ${m.referenceMarche}.` : "",
            url,
          },
          rawVars: url ? { bouton: emailButton(url, "Ouvrir le marché") } : {},
          mode: "queue",
        });
        if (res.ok || res.queued) auMoinsUnEnvoi = true;
      }
      if (auMoinsUnEnvoi) {
        await prisma.contrat.update({
          where: { id: m.id },
          data: { rappelEnvoyeLe: m.dateFin },
        });
        rappelsContrats += 1;
      }
    }

    // Il y avait ici un second passage sur les FICHES LOGICIELS, qui portaient
    // leur propre date de fin de contrat. Elles ne la portent plus : l'échéance
    // vit sur le marché, qu'on vient de parcourir. Les colonnes
    // `fin_contrat_le` / `rappel_envoye_le` gardent leurs valeurs historiques
    // et ne déclenchent plus rien.
  }

  // ── 3. Certificats électroniques arrivant à expiration ──
  if (fallback.length > 0) {
    const fenetreCertificat = new Date(aujourdhui.getTime() + seuilCertificat * 86_400_000);

    // Mêmes bornes que les marchés : un certificat déjà expiré ne se rappelle
    // plus, il se constate — sans la borne basse, les dix-neuf lignes reprises
    // de l'historique déclencheraient un rappel rétroactif au premier passage.
    //
    // Les certificats RÉVOQUÉS sont hors du champ : leur date court encore mais
    // ils ne servent plus, et rien n'est à renouveler. Ceux qu'on a déjà mis en
    // renouvellement, eux, restent surveillés : la commande peut traîner.
    const certificats = await prisma.certificat.findMany({
      where: {
        dateFin: { gte: aujourdhui, lte: fenetreCertificat },
        statut: { not: "revoque" },
      },
      select: {
        id: true,
        titulaire: true,
        fonction: true,
        dateFin: true,
        rappelEnvoyeLe: true,
        numeroSerie: true,
        fournisseur: { select: { nom: true } },
        service: { select: { nom: true } },
      },
    });
    for (const c of certificats) {
      if (!c.dateFin) continue;
      if (c.rappelEnvoyeLe?.getTime() === c.dateFin.getTime()) continue;
      const url = appUrl ? `${appUrl}/certificats/${c.id}` : "";
      // Ce qui aide à agir, et rien de plus : chez qui commander, pour quel
      // service, et sous quel numéro le certificat est connu de l'autorité.
      const details = [
        c.fournisseur ? `Autorité : ${c.fournisseur.nom}.` : "",
        c.service ? `Service : ${c.service.nom}.` : "",
        c.numeroSerie ? `N° de série : ${c.numeroSerie}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      let auMoinsUnEnvoi = false;
      for (const to of fallback) {
        const res = await sendTemplatedMail({
          to,
          kind: "certificat_rappel",
          vars: {
            salutation: greeting(""),
            titulaire: c.titulaire,
            fonction: c.fonction,
            echeance: fmtDate.format(c.dateFin),
            details,
            url,
          },
          rawVars: url ? { bouton: emailButton(url, "Ouvrir le certificat") } : {},
          mode: "queue",
        });
        if (res.ok || res.queued) auMoinsUnEnvoi = true;
      }
      if (auMoinsUnEnvoi) {
        await prisma.certificat.update({
          where: { id: c.id },
          data: { rappelEnvoyeLe: c.dateFin },
        });
        rappelsCertificats += 1;
      }
    }
  }

  return { rappelsTaches, rappelsContrats, rappelsCertificats };
}

export function summarizeEcheances(r: {
  rappelsTaches: number;
  rappelsContrats: number;
  rappelsCertificats: number;
}): string {
  return `${r.rappelsTaches} rappel(s) de tâche, ${r.rappelsContrats} rappel(s) de contrat, ${r.rappelsCertificats} rappel(s) de certificat`;
}
