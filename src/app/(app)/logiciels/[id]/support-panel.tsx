import { Clock, LifeBuoy, Mail, Phone, User } from "lucide-react";
import type { ReactNode } from "react";
import { Card, EmptyState } from "@/components/ui";
import { formatTel } from "@/lib/format";

export type SupportEditeur = {
  id: number;
  nom: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  supportHoraires: string;
  commercialContact: string;
  commercialTelephone: string;
  commercialEmail: string;
  adminContact: string;
  adminTelephone: string;
  adminEmail: string;
};

type Ligne = { icone: ReactNode; label: string; valeur: ReactNode | null };

/** Une ligne « téléphone » : lien `tel:` sans espaces, affichage groupé par deux. */
function ligneTel(label: string, numero: string): Ligne {
  const brut = numero.replace(/\s/g, "");
  return {
    icone: <Phone className="h-4 w-4" />,
    label,
    valeur: brut ? (
      <a href={`tel:${brut}`} className="text-accent hover:underline">
        {formatTel(numero)}
      </a>
    ) : null,
  };
}

/** Une ligne « personne » : un nom, rien à ouvrir. */
function ligneContact(label: string, nom: string): Ligne {
  return { icone: <User className="h-4 w-4" />, label, valeur: nom || null };
}

/** Une ligne « e-mail » : lien `mailto:`. */
function ligneMail(label: string, adresse: string): Ligne {
  return {
    icone: <Mail className="h-4 w-4" />,
    label,
    valeur: adresse ? (
      <a href={`mailto:${adresse}`} className="text-accent hover:underline">
        {adresse}
      </a>
    ) : null,
  };
}

/**
 * Carte de coordonnées : deux colonnes d'icône + libellé + valeur, et un état
 * vide quand aucune ligne n'est renseignée — le lecteur voit alors qu'il n'y a
 * rien à trouver, plutôt qu'une grille de « Non renseigné ».
 */
function CarteContacts({
  titre,
  lignes,
  vide,
  colonnes = 2,
}: {
  titre: string;
  lignes: Ligne[];
  vide: ReactNode;
  /** Tiers pour les contacts (qui, numéro, adresse), moitiés pour le support. */
  colonnes?: 2 | 3;
}) {
  return (
    <Card title={titre}>
      {lignes.every((l) => l.valeur === null) ? (
        <EmptyState>{vide}</EmptyState>
      ) : (
        <dl
          className={`grid gap-x-3 gap-y-2 ${colonnes === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {lignes.map((l) => (
            <div key={l.label} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inset text-muted">
                {l.icone}
              </span>
              <div className="min-w-0">
                <dt className="label">{l.label}</dt>
                <dd className="truncate text-sm text-strong">
                  {l.valeur ?? <span className="text-faint">Non renseigné</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/**
 * Onglet « Support » : les coordonnées de l'ÉDITEUR du logiciel, en lecture
 * seule — l'assistance d'abord, puis les contacts commerciaux et
 * administratifs. Ce sont les cartes « Support » et « Divers » de la fiche
 * éditeur remontées ici, parce que la question « qui j'appelle ? » se pose
 * devant le logiciel, pas devant l'éditeur.
 *
 * La SAISIE reste sur la fiche éditeur (lien en en-tête) : une seule source,
 * valable pour tous ses logiciels — la recopier par logiciel garantirait des
 * numéros divergents.
 */
export function SupportPanel({ editeur }: { editeur: SupportEditeur | null }) {
  if (!editeur) {
    return (
      <EmptyState>
        Aucun éditeur n'est rattaché à ce logiciel. Renseignez-le dans l'onglet « Synthèse » pour
        retrouver ici ses coordonnées de support.
      </EmptyState>
    );
  }

  const support: Ligne[] = [
    {
      icone: <LifeBuoy className="h-4 w-4" />,
      label: "Portail de tickets",
      valeur: editeur.supportUrl ? (
        <a
          href={editeur.supportUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={editeur.supportUrl}
          className="text-accent hover:underline"
        >
          {editeur.supportUrl}
        </a>
      ) : null,
    },
    ligneMail("E-mail du support", editeur.supportEmail),
    ligneTel("Téléphone du support", editeur.supportTelephone),
    {
      icone: <Clock className="h-4 w-4" />,
      label: "Horaires",
      valeur: editeur.supportHoraires || null,
    },
  ];

  const divers: Ligne[] = [
    ligneContact("Contact commercial", editeur.commercialContact),
    ligneTel("Téléphone commercial", editeur.commercialTelephone),
    ligneMail("Mail commercial", editeur.commercialEmail),
    ligneContact("Contact administratif", editeur.adminContact),
    ligneTel("Téléphone administratif", editeur.adminTelephone),
    ligneMail("Mail administratif", editeur.adminEmail),
  ];

  return (
    <div className="space-y-3">
      <CarteContacts
        titre={`Support — ${editeur.nom}`}
        lignes={support}
        vide={<>Aucune coordonnée de support n'est renseignée sur la fiche de « {editeur.nom} ».</>}
      />
      <CarteContacts
        titre={`Divers — ${editeur.nom}`}
        lignes={divers}
        colonnes={3}
        vide={
          <>
            Aucun contact commercial ni administratif n'est renseigné sur la fiche de «{" "}
            {editeur.nom} ».
          </>
        }
      />
    </div>
  );
}
