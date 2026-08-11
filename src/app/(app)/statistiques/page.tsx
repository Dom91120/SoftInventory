import type { Metadata } from "next";
import { BarresCategories, ColonnesMois, JaugesCompletude } from "@/components/graphiques";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/guards";
import { chargerStatistiques } from "@/server/services/statistiques";

export const metadata: Metadata = { title: "Statistiques" };

const fmtEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * L'inventaire vu de haut : ce que le parc contient, qui le fournit, ce qu'il
 * coûte, ce qui vient — et ce qu'on ne sait pas encore.
 *
 * L'écran est rendu côté SERVEUR de bout en bout, sans bibliothèque de
 * graphiques : les formes tiennent en quelques div (voir `components/
 * graphiques.tsx`), et rien n'est envoyé au navigateur pour dessiner des
 * barres.
 *
 * Deux règles ont présidé au choix de ce qui est montré :
 *
 *  1. NE PAS DÉCRIRE LE FORMULAIRE. Certains champs ne sont qu'à leur valeur
 *     par défaut sur presque toutes les fiches — l'authentification, la
 *     localisation des données. En faire un camembert donnerait un graphique
 *     éloquent sur une donnée que personne n'a saisie. Ils n'ont pas leur
 *     carte ; leur absence est comptée là où elle a un sens, en complétude.
 *  2. DIRE CE QU'ON NE SAIT PAS. L'inventaire est jeune : la part des fiches
 *     renseignées est la statistique la plus actionnable de l'écran, celle qui
 *     dit où porter l'effort de saisie. Elle ferme la page, en pleine largeur.
 */
export default async function StatistiquesPage() {
  await requireUser();
  const d = await chargerStatistiques();

  return (
    <>
      <PageHeader
        title="Statistiques"
        subtitle={`Le parc en chiffres — ${d.nbLogiciels} logiciel${d.nbLogiciels > 1 ? "s" : ""} inventorié${d.nbLogiciels > 1 ? "s" : ""}`}
      />

      {/* Trois colonnes de cartes courtes : chaque carte répond à UNE question,
          et l'œil les balaie sans avoir à faire défiler. */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Hébergement" hint="où tourne le parc">
          <BarresCategories data={d.parHebergement} />
        </Card>
        <Card title="Cycle de vie" hint="où en sont les logiciels">
          <BarresCategories data={d.parStatut} />
        </Card>
        <Card title="Criticité" hint="ce que leur arrêt coûterait">
          <BarresCategories data={d.parCriticite} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card title="Technologies" hint="les 8 premières">
          <BarresCategories data={d.parTechnologie} videMessage="Aucune technologie renseignée." />
        </Card>
        <Card title="Modèle de diffusion" hint="propriétaire ou libre">
          <BarresCategories data={d.parSource} />
        </Card>
        <Card title="Éditeurs" hint="les 10 premiers, par logiciels fournis">
          <BarresCategories data={d.topEditeurs} videMessage="Aucun éditeur renseigné." />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card title="Services utilisateurs" hint="les 10 premiers, par logiciels utilisés">
          <BarresCategories data={d.topServices} videMessage="Aucun service rattaché." />
        </Card>
        <Card title="Serveurs" hint="les 10 premiers, par applications hébergées">
          <BarresCategories data={d.topServeurs} videMessage="Aucun serveur rattaché." />
        </Card>
        {/* Le coût par fournisseur se lit avec la couverture de la donnée :
            annoncer une répartition sans dire sur combien de marchés elle
            repose laisserait croire qu'elle couvre le parc entier. */}
        <Card
          title="Coût annuel par fournisseur"
          hint={`${fmtEuros.format(d.coutTotal)} sur ${d.nbMarchesChiffres} marché${d.nbMarchesChiffres > 1 ? "s" : ""} chiffré${d.nbMarchesChiffres > 1 ? "s" : ""} sur ${d.nbMarches}`}
        >
          <BarresCategories
            data={d.coutParFournisseur}
            format={(n) => fmtEuros.format(n)}
            videMessage="Aucun marché chiffré."
          />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* Le seul graphique temporel de l'application, et le seul qui appelle
            une décision : ce qui arrive à terme dans l'année. */}
        <Card title="Échéances des 12 prochains mois" hint="contrats et certificats">
          <ColonnesMois
            data={d.echeances}
            series={[
              { cle: "contrats", label: "Contrats et marchés", couleur: "var(--color-accent)" },
              { cle: "certificats", label: "Certificats", couleur: "var(--color-warn)" },
            ]}
          />
        </Card>
        <Card title="Complétude de l'inventaire" hint="part des fiches logiciel renseignées">
          <JaugesCompletude data={d.completude} />
        </Card>
      </div>
    </>
  );
}
