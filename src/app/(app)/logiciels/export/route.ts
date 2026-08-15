import { csvResponse } from "@/lib/csv";
import { LIBELLES } from "@/schemas/logiciel";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { listLogiciels } from "@/server/services/logiciels";
import { listModesHebergement, listStatutsLogiciels } from "@/server/services/referentiels";
import { depassementContrat, filtresDepuisParams } from "../shared";

export const dynamic = "force-dynamic";

/**
 * Export CSV de l'inventaire, MÊMES filtres que la liste (query string
 * identique) : ce que l'écran montre est ce que le fichier contient.
 * Accessible au lecteur — l'export est une consultation.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/logiciels/export");

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const [logiciels, statuts, hebergements] = await Promise.all([
      listLogiciels(filtresDepuisParams(params)),
      listStatutsLogiciels(),
      listModesHebergement(),
    ]);
    // Libellés du référentiel : le fichier dit la même chose que l.écran.
    const libelleStatut = new Map(statuts.map((s) => [s.cle as string, s.label]));
    const libelleHebergement = new Map(hebergements.map((h) => [h.cle as string, h.label]));

    const rows: (string | number)[][] = [
      [
        "Nom",
        "Éditeur",
        "Description",
        "Statut",
        "Criticité",
        "Hébergement",
        "Technologie",
        "Open source / propriétaire",
        "Version",
        "URL",
        "Authentification",
        "2FA",
        "Services utilisateurs",
        "Utilisateurs",
        "Licences",
        "Plafond dépassé",
        "Référent métier",
        "Référent technique",
      ],
      ...logiciels.map((l) => [
        l.nom,
        l.developpementInterne ? "Développement interne" : (l.editeur?.nom ?? ""),
        l.description,
        libelleStatut.get(l.statut) ?? l.statut,
        l.criticite?.label ?? "",
        libelleHebergement.get(l.hebergement) ?? l.hebergement,
        l.technologie?.label ?? "",
        LIBELLES.typeSource[l.typeSource],
        l.versionInstallee,
        l.url,
        // Vide quand le mode n'est pas renseigné, comme les autres colonnes
        // nullables du fichier.
        l.authentification === null ? "" : LIBELLES.authentification[l.authentification],
        // « OUI » ou rien, comme le dépassement de plafond : c'est la présence
        // du second facteur qui est une information, pas son absence.
        l.authentificationForte ? "OUI" : "",
        l.services.map((s) => s.service.nom).join(", "),
        l.nbUtilisateurs === null ? "" : l.nbUtilisateurs,
        // Vide = illimité ou non renseigné, comme dans la fiche (et comme les
        // autres colonnes nullables du fichier).
        l.nbMaxUtilisateurs === null ? "" : l.nbMaxUtilisateurs,
        depassementContrat(l.nbUtilisateurs, l.nbMaxUtilisateurs) ? "OUI" : "",
        l.referentMetier,
        l.referentTechnique,
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(rows, `logiciels-${stamp}.csv`);
  });
}
