import { Clock, LifeBuoy, Mail, Phone, User } from "lucide-react";
import { Fragment, type ReactNode } from "react";
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

type Ligne = {
  icone: ReactNode;
  label: string;
  valeur: ReactNode | null;
  /** Occupe les trois tiers : les horaires se lisent d'un trait, pas en colonne. */
  pleineLargeur?: boolean;
  /** Ouvre un bloc : un filet la précède. Sépare l'assistance des contacts. */
  separateurAvant?: boolean;
};

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
 * Carte de coordonnées : trois tiers d'icône + libellé + valeur, comme la grille
 * de saisie de la fiche éditeur, et un état vide quand aucune ligne n'est
 * renseignée — le lecteur voit alors qu'il n'y a rien à trouver, plutôt qu'une
 * grille de « Non renseigné ».
 */
function CarteContacts({
  titre,
  lignes,
  vide,
}: {
  titre: string;
  lignes: Ligne[];
  vide: ReactNode;
}) {
  return (
    <Card title={titre}>
      {lignes.every((l) => l.valeur === null) ? (
        <EmptyState>{vide}</EmptyState>
      ) : (
        <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-3">
          {lignes.map((l) => (
            <Fragment key={l.label}>
              {l.separateurAvant ? (
                <div aria-hidden className="my-1 border-t border-line sm:col-span-3" />
              ) : null}
              <div className={`flex items-start gap-3 ${l.pleineLargeur ? "sm:col-span-3" : ""}`}>
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
            </Fragment>
          ))}
        </dl>
      )}
    </Card>
  );
}

/**
 * Onglet « Support » : les coordonnées de l'ÉDITEUR du logiciel, en lecture
 * seule — l'assistance d'abord, puis le commercial et l'administratif. C'est
 * la carte « Contacts » de la fiche éditeur remontée ici, dans le même ordre
 * et la même grille, parce que la question « qui j'appelle ? » se pose devant
 * le logiciel, pas devant l'éditeur.
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

  const lignes: Ligne[] = [
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
      pleineLargeur: true,
    },
    // Le filet ferme l'assistance : en dessous, on n'appelle plus pour une panne.
    { ...ligneContact("Contact commercial", editeur.commercialContact), separateurAvant: true },
    ligneTel("Téléphone commercial", editeur.commercialTelephone),
    ligneMail("Mail commercial", editeur.commercialEmail),
    ligneContact("Contact administratif", editeur.adminContact),
    ligneTel("Téléphone administratif", editeur.adminTelephone),
    ligneMail("Mail administratif", editeur.adminEmail),
  ];

  return (
    <CarteContacts
      titre={`Contacts — ${editeur.nom}`}
      lignes={lignes}
      vide={<>Aucun contact n'est renseigné sur la fiche de « {editeur.nom} ».</>}
    />
  );
}
