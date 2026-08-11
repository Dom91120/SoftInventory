import Link from "next/link";
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
 *
 * `mb-4` et non `mb-3` : l'en-tête annonce l'écran, il lui faut un peu plus
 * d'air que ce qui sépare deux blocs de contenu — sans quoi le titre paraît
 * appartenir à ce qui suit.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className = "mb-4",
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
      {/* `ml-auto` en plus du `justify-between` : celui-ci ne range les actions
          à droite que TANT QU'ELLES PARTAGENT la ligne du titre. Passées à la
          ligne faute de place, elles se retrouvaient seules sur la leur, donc
          au début — les commandes d'une page changeaient de côté avec la
          largeur de la fenêtre. */}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Onglets d'un écran : trait d'accent sous celui qu'on regarde, posé sur un
 * filet qui court d'un bord à l'autre.
 *
 * Une seule forme pour tout ce qui se comporte en onglet. Trois écrans en
 * avaient deux (souligné sur la fiche logiciel, pastilles pleines en
 * Administration) sans qu'aucune règle ne les distingue — l'ordre d'écriture,
 * rien de plus. Le souligné l'emporte : une pastille indigo pleine a le poids
 * visuel d'un bouton d'action, elle donnait à un onglet, qui ne fait que
 * déplacer le regard, le rang d'une commande. Il tient aussi mieux quand les
 * onglets sont nombreux (huit sur la fiche, autant en Référentiels).
 *
 * À NE PAS confondre avec le sélecteur de vue des Serveurs, encadré et porteur
 * d'icônes : un onglet change CE QUE la page montre (`?onglet=`), un sélecteur
 * de vue change COMMENT elle le montre, à contenu identique (`?vue=`). Deux
 * gestes différents, deux formes différentes.
 *
 * Des LIENS et non des boutons : l'onglet actif vit dans l'URL, il se recharge,
 * se met en favori et se partage, sans un octet d'état client.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  href,
}: {
  /** Dans l'ordre d'affichage. `badge` pour un compte à annoncer sur l'onglet. */
  onglets: ReadonlyArray<{ key: T; label: string; badge?: ReactNode }>;
  actif: T;
  /** Fabrique l'adresse d'un onglet — chaque écran a la sienne. */
  href: (key: T) => string;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line pb-px">
      {onglets.map((o) => (
        <Link
          key={o.key}
          href={href(o.key)}
          aria-current={o.key === actif ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition ${
            o.key === actif
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-strong"
          }`}
        >
          {o.label}
          {o.badge}
        </Link>
      ))}
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
  /**
   * Un texte, presque toujours. `ReactNode` pour le libellé qu'il faut savoir
   * COUPER : « Contrats/Marchés » n'a pas d'espace, ne se replie donc nulle
   * part, et se faisait rogner par le cadre. Un `<wbr />` posé sur la barre
   * oblique lui donne l'endroit où céder.
   */
  label: ReactNode;
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
      // `px-3 gap-3` sur un téléphone, `px-5 gap-4` au-delà : deux tuiles par
      // rangée sur 375 px ne laissaient que 67 px au libellé une fois l'icône et
      // les retraits posés, et « CONTRATS » — 81 px — s'y faisait rogner. Les
      // vingt pixels rendus ici lui suffisent.
      className="relative flex h-full items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface px-3 py-3 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:gap-4 sm:px-5"
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
      {/* `@container` + `flex-1` : le bloc de texte occupe la place restante, et
          un libellé peut alors interroger CETTE place pour décider de sa forme
          — « Contrats/Marchés » sur une ligne, ou en deux mots empilés quand la
          tuile est trop étroite. Sans `flex-1`, le conteneur se mesurerait sur
          son propre contenu, et la question n'aurait plus de sens. */}
      <div className="@container min-w-0 flex-1">
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
