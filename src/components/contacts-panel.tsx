import { BadgeCheck, Clock, LifeBuoy, Mail, Phone, User } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Card, EmptyState } from "@/components/ui";
import { formatTel } from "@/lib/format";

/**
 * Les coordonnées d'une société de l'annuaire — l'éditeur d'un logiciel,
 * l'autorité de certification d'un certificat : c'est la même table, donc les
 * mêmes champs, et la même carte pour les lire.
 */
export type ContactsSociete = {
  id: number;
  nom: string;
  supportUrl: string;
  supportEmail: string;
  supportTelephone: string;
  numeroClient: string;
  supportHoraires: string;
  supportHoraires2: string;
  commercialContact: string;
  commercialTelephone: string;
  commercialEmail: string;
  commercialContact2: string;
  commercialTelephone2: string;
  commercialEmail2: string;
  adminContact: string;
  adminTelephone: string;
  adminEmail: string;
  dpoContact: string;
  dpoTelephone: string;
  dpoEmail: string;
};

type Ligne = {
  icone: ReactNode;
  label: string;
  valeur: ReactNode | null;
  /**
   * Nombre de tiers occupés. Les horaires en prennent DEUX : ils se lisent d'un
   * trait, pas en colonne, mais laissent le premier tiers au numéro de client
   * qui ouvre leur rang.
   */
  tiers?: 2 | 3;
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
              <div
                className={`flex items-start gap-3 ${
                  l.tiers === 3 ? "sm:col-span-3" : l.tiers === 2 ? "sm:col-span-2" : ""
                }`}
              >
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
 * Onglet « Contacts » : les coordonnées de la SOCIÉTÉ rattachée à la fiche —
 * l'éditeur d'un logiciel, l'autorité de certification d'un certificat —, en
 * lecture seule : l'assistance d'abord, puis le commercial et l'administratif.
 * C'est la carte « Contacts » de la fiche éditeur remontée ici, dans le même
 * ordre et la même grille, parce que la question « qui j'appelle ? » se pose
 * devant le logiciel ou le certificat, pas devant l'éditeur.
 *
 * La SAISIE reste sur la fiche éditeur (lien en en-tête) : une seule source,
 * valable pour tout ce qui s'y rattache — la recopier fiche par fiche
 * garantirait des numéros divergents.
 *
 * `sansSociete` dit ce qui manque AVEC LES MOTS de la fiche qui appelle : ce
 * n'est pas le même champ qu'on ira remplir selon qu'il s'agit d'un éditeur ou
 * d'une autorité de certification.
 */
export function ContactsPanel({
  societe,
  sansSociete,
}: {
  societe: ContactsSociete | null;
  sansSociete: ReactNode;
}) {
  if (!societe) return <EmptyState>{sansSociete}</EmptyState>;

  const lignes: Ligne[] = [
    {
      icone: <LifeBuoy className="h-4 w-4" />,
      label: "Portail de support",
      valeur: societe.supportUrl ? (
        <a
          href={societe.supportUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={societe.supportUrl}
          className="text-accent hover:underline"
        >
          {societe.supportUrl}
        </a>
      ) : null,
    },
    // Téléphone puis e-mail, comme le commercial et l'administratif plus bas et
    // comme la carte « Contacts » de la fiche éditeur : l'assistance était la
    // seule à prendre les deux à contresens.
    ligneTel("Tél du support", societe.supportTelephone),
    ligneMail("Mail du support", societe.supportEmail),
    // Le premier rang porte les trois CANAUX — par où l'on joint l'assistance.
    // Ce qu'on lui dira une fois en ligne, numéro de client et horaires, ouvre
    // le rang suivant : la fiche éditeur les saisit dans l'ordre inverse, mais
    // elle sert à remplir, pas à appeler.
    {
      icone: <BadgeCheck className="h-4 w-4" />,
      label: "N° de client",
      valeur: societe.numeroClient || null,
    },
    {
      icone: <Clock className="h-4 w-4" />,
      label: "Horaires du support",
      // Les deux régimes sont saisis séparément — la semaine, puis le jour qui
      // en sort — mais se lisent d'un trait, joints par le « · » qui sépare
      // partout ailleurs les valeurs d'une même énumération. La liste des
      // éditeurs, elle, les empile : sa colonne est étroite.
      valeur:
        [societe.supportHoraires, societe.supportHoraires2].filter(Boolean).join(" · ") || null,
      tiers: 2,
    },
    // Le filet ferme l'assistance : en dessous, on n'appelle plus pour une panne.
    { ...ligneContact("Contact commercial", societe.commercialContact), separateurAvant: true },
    ligneTel("Tél commercial", societe.commercialTelephone),
    ligneMail("Mail commercial", societe.commercialEmail),
    // Le second commercial ne prend son rang que s'il existe : la fiche éditeur
    // le laisse sans titre parce que la position suffit, mais ici chaque valeur
    // est nommée, et trois « Non renseigné » de plus dans une grille qui en
    // compte déjà se lisent comme un manque plutôt que comme une absence. La
    // plupart des éditeurs n'ont qu'un commercial.
    ...(societe.commercialContact2 || societe.commercialTelephone2 || societe.commercialEmail2
      ? [
          ligneContact("Contact commercial 2", societe.commercialContact2),
          ligneTel("Tél commercial 2", societe.commercialTelephone2),
          ligneMail("Mail commercial 2", societe.commercialEmail2),
        ]
      : []),
    ligneContact("Contact administratif", societe.adminContact),
    ligneTel("Tél administratif", societe.adminTelephone),
    ligneMail("Mail administratif", societe.adminEmail),
    ligneContact("DPO", societe.dpoContact),
    ligneTel("Tél DPO", societe.dpoTelephone),
    ligneMail("Mail DPO", societe.dpoEmail),
  ];

  return (
    <CarteContacts
      titre={`Contacts — ${societe.nom}`}
      lignes={lignes}
      vide={<>Aucun contact n'est renseigné sur la fiche de « {societe.nom} ».</>}
    />
  );
}
