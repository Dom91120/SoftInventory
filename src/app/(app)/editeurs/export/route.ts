import { csvResponse } from "@/lib/csv";
import { CATEGORIES_EDITEUR, LIBELLES_CATEGORIE_EDITEUR } from "@/schemas/editeur";
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
    const categorie = CATEGORIES_EDITEUR.find((c) => c === url.searchParams.get("categorie"));
    const editeurs = await listEditeurs({
      q: url.searchParams.get("q") ?? undefined,
      categorie,
    });

    const rows: (string | number)[][] = [
      [
        "Éditeur",
        "Catégorie",
        "Site web",
        "Adresse",
        "Code postal",
        "Ville",
        "Téléphone standard",
        "E-mail",
        "Portail de tickets",
        "E-mail du support",
        "Téléphone du support",
        "N° de client",
        "Horaires du support",
        "Horaires du support (2ᵉ ligne)",
        "Contact commercial",
        "Téléphone commercial",
        "Mail commercial",
        "Contact commercial 2",
        "Téléphone commercial 2",
        "Mail commercial 2",
        "Contact administratif",
        "Téléphone administratif",
        "Mail administratif",
        "DPO",
        "Téléphone DPO",
        "Mail DPO",
        "Observations",
      ],
      ...editeurs.map((e) => [
        e.nom,
        LIBELLES_CATEGORIE_EDITEUR[e.categorie],
        e.siteWeb,
        e.adresse,
        e.codePostal,
        e.ville,
        e.telephone,
        e.email,
        e.supportUrl,
        e.supportEmail,
        e.supportTelephone,
        e.numeroClient,
        e.supportHoraires,
        e.supportHoraires2,
        e.commercialContact,
        e.commercialTelephone,
        e.commercialEmail,
        e.commercialContact2,
        e.commercialTelephone2,
        e.commercialEmail2,
        e.adminContact,
        e.adminTelephone,
        e.adminEmail,
        e.dpoContact,
        e.dpoTelephone,
        e.dpoEmail,
        e.notes,
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(rows, `editeurs-${stamp}.csv`);
  });
}
