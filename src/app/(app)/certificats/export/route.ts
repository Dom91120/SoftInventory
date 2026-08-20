import { csvResponse } from "@/lib/csv";
import { DATE_FMT_FR_UTC } from "@/lib/format";
import { LIBELLES_CERTIFICAT, nomTitulaire } from "@/schemas/certificat";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { listCertificats } from "@/server/services/certificats";
import { filtresDepuisParams } from "../shared";

export const dynamic = "force-dynamic";

/**
 * Export CSV, MÊMES filtres que la liste (query string identique) : ce que
 * l'écran montre est ce que le fichier contient. Accessible au lecteur —
 * l'export est une consultation.
 *
 * Les deux codes de l'autorité n'y figurent PAS, et pas seulement parce qu'on
 * les omet : le service ne les remonte pas. Un tableur qui circule par courriel
 * est le dernier endroit où poser un secret d'exploitation.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/certificats/export");

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const certificats = await listCertificats(filtresDepuisParams(params));
    const date = (d: Date | null) => (d === null ? "" : DATE_FMT_FR_UTC.format(d));

    const rows: (string | number)[][] = [
      [
        "Titulaire",
        "Fonction",
        "Service",
        "Autorité de certification",
        "Usage",
        "Support",
        "Niveau",
        "N° de série",
        "Début de validité",
        "Fin de validité",
        "Durée (ans)",
        "Montant TTC",
        "Imputation",
        "Bon de commande le",
        "Statut",
        "E-mail",
        "Observations",
      ],
      ...certificats.map((c) => [
        nomTitulaire(c),
        c.fonction,
        c.service?.nom ?? "",
        c.fournisseur?.nom ?? "",
        c.usage ? LIBELLES_CERTIFICAT.usage[c.usage] : "",
        c.support ? LIBELLES_CERTIFICAT.support[c.support] : "",
        c.niveau,
        c.numeroSerie,
        date(c.dateDebut),
        date(c.dateFin),
        c.dureeAnnees ?? "",
        c.montantTtc === null ? "" : Number(c.montantTtc),
        c.imputation,
        date(c.bonCommandeLe),
        LIBELLES_CERTIFICAT.statut[c.statut],
        c.email,
        c.notes,
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(rows, `certificats-${stamp}.csv`);
  });
}
