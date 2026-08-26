import { csvResponse } from "@/lib/csv";
import { dateCalendaire } from "@/lib/taches-core";
import { LIBELLES } from "@/schemas/logiciel";
import { seuilsRappel } from "@/server/config";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { etatMarche, listContrats, trierContrats } from "@/server/services/contrats";
import { filtresContratsDepuisParams, triContratsDepuisParams } from "../shared";

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
    const [bruts, { contrat: seuilJours }] = await Promise.all([
      listContrats(filtresContratsDepuisParams(params)),
      seuilsRappel(),
    ]);

    // Même fenêtre que l'écran : l'état exporté est celui qu'on vient de lire.
    const jour = dateCalendaire(new Date());
    const limite = new Date(jour.getTime() + seuilJours * 86_400_000);

    // Même ORDRE que l'écran, et pas seulement mêmes filtres : la colonne
    // cliquée voyage dans la query string, et le fichier est l'extrait de la
    // liste telle qu'elle est triée au moment où on l'emporte.
    const { tri, sens } = triContratsDepuisParams(params);
    const contrats = trierContrats(bruts, tri, sens, jour, limite);
    const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    const montant = (m: unknown) => (m === null || m === undefined ? "" : String(m));

    // Ce que l'écran affiche pour une nature non renseignée : « Marché ». Le
    // fichier ne peut pas dire autre chose que la liste dont il est l'extrait.
    const nature = (n: string | null) =>
      LIBELLES.natureMarche[n === "contrat" ? "contrat" : "marche"];
    const entier = (n: number | null) => (n === null ? "" : String(n));

    const rows: (string | number)[][] = [
      [
        "Nature",
        "Référence",
        "Référence fournisseur",
        "Libellé",
        "Fournisseur",
        "Logiciels couverts",
        "Début",
        "Fin",
        "Durée (ans)",
        "Renouvelable (fois)",
        "Période de renouvellement (ans)",
        "État",
        "Montant annuel (€)",
        "Maximum annuel (€)",
        "Montant total du marché (€)",
        "Pièces",
        "Notes",
      ],
      ...contrats.map((c) => [
        nature(c.nature),
        c.referenceMarche,
        c.referenceFournisseur,
        c.libelle,
        c.fournisseur?.nom ?? "",
        c.logiciels.map((l) => l.logiciel.nom).join(", "),
        date(c.dateDebut),
        date(c.dateFin),
        entier(c.dureeAnnees),
        // Zéro EXPORTÉ, là où l'écran le tait : le tableur compte et filtre,
        // et une case vide n'y vaut pas « non reconductible ».
        entier(c.renouvellements),
        entier(c.dureeRenouvellement),
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
