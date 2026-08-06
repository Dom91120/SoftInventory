import { csvResponse } from "@/lib/csv";
import { reponseApi, requireRoleApi } from "@/server/guards-api";
import { listEditeurs } from "@/server/services/editeurs";

export const dynamic = "force-dynamic";

/**
 * Export CSV de l'annuaire, MÊME recherche que la liste (query string
 * identique) : ce que l'écran montre est ce que le fichier contient.
 * Accessible au lecteur — l'export est une consultation.
 */
export function GET(request: Request): Promise<Response> {
  return reponseApi(async () => {
    await requireRoleApi("lecteur", "/editeurs/export");

    const url = new URL(request.url);
    const editeurs = await listEditeurs({ q: url.searchParams.get("q") ?? undefined });

    const rows: (string | number)[][] = [
      [
        "Éditeur",
        "Site web",
        "Adresse",
        "Code postal",
        "Ville",
        "Téléphone standard",
        "E-mail",
        "Portail de tickets",
        "E-mail du support",
        "Téléphone du support",
        "Horaires du support",
        "Contact commercial",
        "Téléphone commercial",
        "Mail commercial",
        "Contact administratif",
        "Téléphone administratif",
        "Mail administratif",
        "Observations",
      ],
      ...editeurs.map((e) => [
        e.nom,
        e.siteWeb,
        e.adresse,
        e.codePostal,
        e.ville,
        e.telephone,
        e.email,
        e.supportUrl,
        e.supportEmail,
        e.supportTelephone,
        e.supportHoraires,
        e.commercialContact,
        e.commercialTelephone,
        e.commercialEmail,
        e.adminContact,
        e.adminTelephone,
        e.adminEmail,
        e.notes,
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(rows, `editeurs-${stamp}.csv`);
  });
}
