import type { ReactNode } from "react";

/**
 * Kit de composants « style cparfait » (cf. globals.css pour les classes .btn,
 * .card, .badge…). Composants SERVEUR par défaut : aucun état, aucune
 * interactivité — utilisables des deux côtés.
 */

/**
 * En-tête de page : titre + sous-titre + actions à droite.
 * `className` remplace la marge par défaut, pour les cas où l'en-tête est
 * imbriqué dans une autre disposition (flèches de navigation, par exemple).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className = "mb-3",
}: {
  /** Texte, ou composition quand le titre porte une action (icône d'ouverture…). */
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-strong">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Carte avec en-tête à barre d'accent (simcity) ; `title` optionnel. */
export function Card({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  /**
   * Une chaîne dans la quasi-totalité des cas. `ReactNode` pour la carte dont
   * le TITRE mène quelque part — « Mes tâches » vers la liste des tâches : le
   * lien s'habille alors de `card-title` et reste le titre de la carte, plutôt
   * qu'une commande de plus à sa droite.
   */
  title?: ReactNode;
  /**
   * Mention discrète accolée au titre — une contrainte de saisie, un format
   * admis. Elle vit dans l'en-tête plutôt qu'en tête de contenu, où elle
   * repoussait d'une rangée ce que la carte a à montrer. Effacée sous 640 px :
   * elle y disputerait la ligne aux commandes, qui, elles, ne peuvent pas
   * partir.
   */
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="card-header pl-7">
          {/* Centrage et non alignement des lignes de base : le titre est en
              CAPITALES, sans jambages, quand la mention en a — « p », « j »,
              « q ». Sur une même ligne de base, la mention paraissait basse.
              Un demi-point de moins la met au second rang sans la rendre
              illisible. */}
          <span className="flex min-w-0 items-center gap-2">
            <h2 className="card-title shrink-0">{title}</h2>
            {/* `title` posé sans condition : les navigateurs n'offrent aucune
                infobulle d'office sur un texte coupé, et savoir s'il l'est
                demande de mesurer à l'exécution — donc de rendre la carte
                côté client pour une bulle. Quand la mention tient en entier,
                l'infobulle la répète : sans conséquence. */}
            {hint ? (
              <span
                title={hint}
                className="hidden truncate text-[11px]/4 font-normal normal-case tracking-normal text-faint sm:inline"
              >
                {hint}
              </span>
            ) : null}
          </span>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="card-body">{children}</div>
    </section>
  );
}

/**
 * Tuile KPI signature : liseré coloré 4 px, gros chiffre en chasse fixe,
 * libellé micro-caps. Toute la tuile est un lien vers l'écran où l'on AGIT
 * sur le chiffre.
 *
 * Le cadre remplit la hauteur qu'on lui donne (`h-full` interne, sans effet
 * tant que le parent n'en impose aucune) : une RANGÉE de tuiles se pose donc
 * en `h-full` et s'aligne sur la plus haute, qu'il y ait ou non une mention
 * sous le libellé et qu'un libellé passe ou non à la ligne. Sans cela chacune
 * se dimensionnait sur son propre texte et la rangée montait en escalier. Le
 * contenu reste centré : la hauteur gagnée se partage au-dessus et en dessous.
 */
export function Stat({
  value,
  label,
  hint,
  icon,
  tone = "accent",
  href,
  className = "",
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "accent" | "ok" | "warn" | "danger" | "info" | "muted";
  href?: string;
  /** `h-full` pour une tuile en rangée ; rien pour une tuile isolée. */
  className?: string;
}) {
  const rail: Record<string, string> = {
    accent: "var(--color-accent)",
    ok: "var(--color-ok)",
    warn: "var(--color-warn)",
    danger: "var(--color-danger)",
    info: "var(--color-info)",
    muted: "var(--color-faint)",
  };
  const inner = (
    <div
      className="relative flex h-full items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface px-5 py-3 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md"
      style={{ borderLeftWidth: 0 }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: rail[tone] }}
      />
      {icon ? (
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            color: rail[tone],
            background: `color-mix(in srgb, ${rail[tone]} 10%, transparent)`,
          }}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="font-mono text-[1.7rem] font-semibold leading-tight text-strong tabular-nums">
          {value}
        </div>
        <div className="text-[0.74rem] font-semibold uppercase tracking-wider text-muted">
          {label}
        </div>
        {hint ? <div className="truncate text-xs text-faint">{hint}</div> : null}
      </div>
    </div>
  );
  return href ? (
    <a href={href} className={`group block ${className}`}>
      {inner}
    </a>
  ) : (
    <div className={`group ${className}`}>{inner}</div>
  );
}

/** État vide en pointillés. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-sub px-6 py-6 text-center text-sm text-faint">
      {children}
    </div>
  );
}

/** Champ de formulaire : libellé micro-caps + contrôle + aide. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  infobulle,
  action,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  /**
   * La même chose que `hint`, mais AU SURVOL plutôt que sous le champ. Pour
   * une précision qui compte à la première saisie et jamais plus — elle prenait
   * alors une ligne sous chaque champ, à toutes les visites, et creusait la
   * carte. `hint` reste pour ce qui doit se lire sans être cherché.
   *
   * Portée par le bloc entier et non par le seul libellé : on survole le CHAMP
   * quand on hésite à le remplir, pas son titre. Les descendants qui ont leur
   * propre `title` — le raccourci d'`action` — gardent le leur.
   */
  infobulle?: string;
  /**
   * Petit geste accolé au LIBELLÉ — ouvrir l'adresse saisie, écrire au
   * contact. Hors du <label> et non dedans : cliquer un libellé donne le focus
   * au champ, et un lien qui vit là serait pris dans ce geste.
   */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div title={infobulle}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <label className="label !mb-0" htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
        {action}
      </div>
      {children}
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
