import { csvResponse } from "@/lib/csv";
import { LIBELLES_TYPE_OS, TYPES_OS } from "@/schemas/serveur";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { listServeursAvecLogiciels } from "@/server/services/serveurs";

export const dynamic = "force-dynamic";

/**
 * Export CSV du parc, MÊME recherche que la liste (query string identique) :
 * ce que l'écran montre est ce que le fichier contient. Les logiciels d'une
 * machine tiennent dans une cellule, séparés par « ; » — une ligne par serveur,
 * comme à l'écran. Accessible au lecteur — l'export est une consultation.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/serveurs/export");

    const url = new URL(request.url);
    const typeOs = TYPES_OS.find((t) => t === url.searchParams.get("os"));
    const serveurs = await listServeursAvecLogiciels({
      q: url.searchParams.get("q") ?? undefined,
      typeOs,
    });

    const rows: (string | number)[][] = [
      ["Serveur", "Virtuel", "OS", "Version", "Emplacement", "Logiciels installés", "Notes"],
      ...serveurs.map((s) => [
        s.nom,
        s.virtuel ? "Oui" : "Non",
        s.typeOs ? LIBELLES_TYPE_OS[s.typeOs] : "",
        s.os,
        s.localisation,
        s.logiciels.map((l) => l.logiciel.nom).join(" ; "),
        s.notes,
      ]),
    ];
    return csvResponse(rows, "serveurs.csv");
  });
}
