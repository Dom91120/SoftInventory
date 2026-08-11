// Graphiques de l'application — composants SERVEUR, sans bibliothèque : des
// div, des pourcentages et les couleurs des référentiels. Une page qui affiche
// un graphique reste ainsi rendue côté serveur, et rien n'est envoyé au
// navigateur pour dessiner cinq barres.
//
// Deux formes seulement, chacune pour une question :
//  - BARRES horizontales pour comparer des CATÉGORIES entre elles ;
//  - COLONNES verticales pour lire une évolution dans le TEMPS.
//
// Ni camembert ni barre empilée : l'œil compare mal les angles, et un empilement
// écrase les petits postes dès qu'un seul domine — ce qui est la règle dans cet
// inventaire, pas l'exception.

export type PointSerie = { label: string; nb: number; couleur?: string };

/**
 * Barres horizontales, une par catégorie. Chaque ligne porte son libellé, sa
 * part et son compte : la légende EST le graphique, l'information n'est pas
 * écrite deux fois.
 *
 * `couleur` vient du référentiel quand il en donne une (criticité,
 * hébergement). Sinon toutes les barres partagent la teinte d'accent : colorier
 * arbitrairement des catégories qui n'ont pas de code couleur ferait croire à
 * un sens qui n'existe pas — dans un classement, c'est la LONGUEUR qui parle.
 *
 * `unite` remplace le compte par une valeur mise en forme (un montant, par
 * exemple) ; la part reste calculée sur la somme de la série.
 */
export function BarresCategories({
  data,
  format,
  videMessage = "Aucune donnée.",
}: {
  data: PointSerie[];
  /** Mise en forme du nombre affiché à droite. Par défaut, le nombre brut. */
  format?: (nb: number) => string;
  videMessage?: string;
}) {
  const total = data.reduce((s, d) => s + d.nb, 0);
  if (total === 0) return <p className="text-sm text-faint">{videMessage}</p>;
  const part = (nb: number) => (nb / total) * 100;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label}>
          {/* Libellé et valeur au-dessus de la barre, et non à ses côtés : dans
              une colonne étroite, les trois sur une même ligne ne laisseraient à
              la barre que quelques dizaines de pixels — trop peu pour qu'une
              longueur veuille dire quelque chose. */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-muted" title={d.label}>
              {d.label}
              <span className="text-faint"> · {Math.round(part(d.nb))} %</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-strong tabular-nums">
              {format ? format(d.nb) : d.nb}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-inset">
            {/* `min-width` : un poste à une unité sur cent ferait moins d'un
                pixel et disparaîtrait, alors que sa ligne l'annonce juste
                au-dessus — la barre mentirait par omission. */}
            <div
              className="h-full min-w-[3px] rounded-full"
              style={{
                width: `${part(d.nb)}%`,
                background: d.couleur ?? "var(--color-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Colonnes verticales sur un axe de TEMPS — la seule forme qui laisse voir un
 * creux, une pointe, une saisonnalité. Les mois vides gardent leur colonne :
 * un calendrier troué se lit mal, et l'absence d'échéance est elle-même une
 * information.
 *
 * Deux séries empilées par colonne : ici l'empilement se justifie, chaque
 * colonne ne portant que deux postes et la question étant « combien de choses
 * ce mois-là », le détail venant en second.
 */
export function ColonnesMois({
  data,
  series,
}: {
  data: Array<{ mois: string } & Record<string, number | string>>;
  /** Les séries empilées, dans l'ordre d'empilement (le bas d'abord). */
  series: Array<{ cle: string; label: string; couleur: string }>;
}) {
  const totalDe = (d: (typeof data)[number]) =>
    series.reduce((s, serie) => s + Number(d[serie.cle] ?? 0), 0);
  // L'échelle se cale sur le mois le plus chargé, jamais sous 1 : sans ce
  // plancher, douze mois vides donneraient une division par zéro.
  const maximum = Math.max(1, ...data.map(totalDe));
  const totalGeneral = data.reduce((s, d) => s + totalDe(d), 0);

  if (totalGeneral === 0) {
    return <p className="text-sm text-faint">Aucune échéance dans les douze prochains mois.</p>;
  }

  return (
    <div>
      {/* Chaque colonne prend TOUTE la hauteur du cadre (`h-full`) et pousse sa
          barre en bas (`justify-end`) : sans hauteur de référence, le
          pourcentage de la barre n'aurait rien à quoi se rapporter et la
          colonne resterait plate. */}
      <div className="flex h-32 items-end gap-1.5">
        {data.map((d) => {
          const t = totalDe(d);
          return (
            <div
              key={d.mois}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              {/* Le compte au-dessus de la colonne, et seulement s'il y a
                  quelque chose : un « 0 » répété douze fois ferait une ligne de
                  bruit au-dessus d'un graphique qui dit déjà « rien ». */}
              <span className="text-[10px] font-semibold text-muted tabular-nums">
                {t > 0 ? t : ""}
              </span>
              <div
                className="flex w-full flex-col-reverse justify-start overflow-hidden rounded-t"
                // Plancher de 3 px : un mois à une seule échéance, face à un
                // mois qui en porte dix, ferait une colonne de moins d'un pixel
                // — présente dans le compte au-dessus, absente du graphique.
                style={{ height: t === 0 ? 0 : `max(3px, ${(t / maximum) * 100}%)` }}
              >
                {series.map((serie) => {
                  const v = Number(d[serie.cle] ?? 0);
                  if (v === 0) return null;
                  return (
                    <div
                      key={serie.cle}
                      title={`${serie.label} : ${v}`}
                      style={{ height: `${(v / t) * 100}%`, background: serie.couleur }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Les mois sous les colonnes, et la légende des deux séries en dessous. */}
      <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5">
        {data.map((d) => (
          <span key={d.mois} className="min-w-0 flex-1 truncate text-center text-[10px] text-faint">
            {d.mois}
          </span>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((serie) => (
          <li key={serie.cle} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: serie.couleur }} />
            {serie.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Jauge de complétude : la part des fiches qui portent une information.
 *
 * Même forme que les barres de catégories, mais chaque ligne se lit sur SON
 * PROPRE total et non sur la somme de la série — « 74 fiches sur 85 » n'a de
 * sens que rapporté à 85, pas à la somme des autres lignes.
 */
export function JaugesCompletude({
  data,
}: {
  data: Array<{ label: string; renseignes: number; total: number }>;
}) {
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const part = d.total === 0 ? 0 : (d.renseignes / d.total) * 100;
        return (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-muted">{d.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-faint">
                <span className="text-sm font-semibold text-strong">{Math.round(part)} %</span>
                <span className="ml-1.5">
                  {d.renseignes}/{d.total}
                </span>
              </span>
            </div>
            {/* Vert au-delà des trois quarts, ambre à partir de la moitié, rouge
                en deçà : la couleur dit d'un coup d'œil où porter l'effort,
                sans qu'on ait à lire chaque pourcentage. */}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${part}%`,
                  background:
                    part >= 75
                      ? "var(--color-ok)"
                      : part >= 50
                        ? "var(--color-warn)"
                        : "var(--color-danger)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
