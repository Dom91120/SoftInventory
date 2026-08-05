import { Clock, LifeBuoy, Mail, Phone } from "lucide-react";
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
};

/**
 * Onglet « Support » : les coordonnées d'assistance de l'ÉDITEUR du logiciel,
 * en lecture seule. C'est la carte « Support » de la fiche éditeur remontée
 * ici, parce que la question « qui j'appelle quand ça casse ? » se pose devant
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

  // `tel:` n'aime pas les espaces de saisie ; l'affichage, lui, garde le
  // groupement par deux des numéros français (formatTel).
  const telBrut = editeur.supportTelephone.replace(/\s/g, "");
  const lignes: { icone: ReactNode; label: string; valeur: ReactNode | null }[] = [
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
    {
      icone: <Mail className="h-4 w-4" />,
      label: "E-mail du support",
      valeur: editeur.supportEmail ? (
        <a href={`mailto:${editeur.supportEmail}`} className="text-accent hover:underline">
          {editeur.supportEmail}
        </a>
      ) : null,
    },
    {
      icone: <Phone className="h-4 w-4" />,
      label: "Téléphone du support",
      valeur: telBrut ? (
        <a href={`tel:${telBrut}`} className="text-accent hover:underline">
          {formatTel(editeur.supportTelephone)}
        </a>
      ) : null,
    },
    {
      icone: <Clock className="h-4 w-4" />,
      label: "Horaires",
      valeur: editeur.supportHoraires || null,
    },
  ];

  return (
    <Card title={`Support — ${editeur.nom}`}>
      {lignes.every((l) => l.valeur === null) ? (
        <EmptyState>
          Aucune coordonnée de support n'est renseignée sur la fiche de « {editeur.nom} ».
        </EmptyState>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
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
