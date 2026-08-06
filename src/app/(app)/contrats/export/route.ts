import { csvResponse } from "@/lib/csv";
import { dateCalendaire } from "@/lib/taches-core";
import { seuilsRappel } from "@/server/config";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { etatMarche, listContrats } from "@/server/services/contrats";
import { filtresContratsDepuisParams } from "../shared";

export const dynamic = "force-dynamic";

const LIBELLE_ETAT = {
  termine: "Terminé",
  a_renouveler: "À renouveler",
  en_cours: "En cours",
} as const;

/**
 * Export CSV des marchés, MÊMES filtres que la liste (query string identique) :
 * ce que l'écran montre est ce que le fichier contient. Accessible au lecteur —
 * l'export est une consultation.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/contrats/export");

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const [contrats, { contrat: seuilJours }] = await Promise.all([
      listContrats(filtresContratsDepuisParams(params)),
      seuilsRappel(),
    ]);

    // Même fenêtre que l'écran : l'état exporté est celui qu'on vient de lire.
    const jour = dateCalendaire(new Date());
    const limite = new Date(jour.getTime() + seuilJours * 86_400_000);
    const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    const montant = (m: unknown) => (m === null || m === undefined ? "" : String(m));

    const rows: (string | number)[][] = [
      [
        "Référence",
        "Libellé",
        "Fournisseur",
        "Logiciels couverts",
        "Début",
        "Fin",
        "État",
        "Montant annuel (€)",
        "Maximum annuel (€)",
        "Montant total du marché (€)",
        "Pièces",
        "Notes",
      ],
      ...contrats.map((c) => [
        c.referenceMarche,
        c.libelle,
        c.fournisseur?.nom ?? "",
        c.logiciels.map((l) => l.logiciel.nom).join(", "),
        date(c.dateDebut),
        date(c.dateFin),
        LIBELLE_ETAT[etatMarche(c.dateFin, jour, limite)],
        montant(c.montantAnnuel),
        montant(c.montantMaxi),
        montant(c.montantTotal),
        c._count.pieces,
        c.notes,
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(rows, `contrats-${stamp}.csv`);
  });
}
