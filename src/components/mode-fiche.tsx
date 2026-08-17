"use client";

import { SquarePen } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CommandesOnglet } from "@/components/commandes-onglet";
import { useConfirmation } from "@/components/confirmation";

/**
 * LE mode « je modifie cette fiche », partagé par tous ses onglets.
 *
 * Le crayon vit au bout de la barre d'onglets, au niveau des onglets et non
 * d'une carte : ce qu'il dit vaut donc pour la fiche ENTIÈRE. Allumé, chaque
 * onglet offre ses saisies et ses corbeilles ; éteint, tout est en lecture.
 * Un onglet n'a plus son propre verrou — il lit celui-ci.
 *
 * Ce que chaque panneau doit au mode, il le déclare en s'INSCRIVANT :
 * « ai-je quelque chose de non enregistré ? » (`sale`), « rends tes valeurs
 * enregistrées » (`rendre`), et pour ceux qui portent un formulaire,
 * « enregistre-le » (`enregistrer`). C'est ce qui donne au mode ses trois
 * issues, qui valent chacune pour la fiche ENTIÈRE : « Enregistrer » fait
 * enregistrer chaque panneau qui porte une saisie, « Annuler » et le crayon
 * rendent tout — une seule question si quoi que ce soit serait perdu.
 */
type Inscription = {
  /** Vrai si le panneau porte une saisie non enregistrée qu'un reset perdrait. */
  sale: () => boolean;
  /** Rend au panneau ses valeurs enregistrées — le geste d'« Annuler ». */
  rendre: () => void;
  /**
   * Enregistre la saisie du panneau ; vrai si c'est fait. ABSENT sur les
   * panneaux dont les gestes s'appliquent au clic : leur seule saisie en
   * suspens est un sous-formulaire ouvert, que personne ne peut valider à leur
   * place — il tient alors le mode ouvert.
   */
  enregistrer?: () => Promise<boolean>;
};

type ContexteModeFiche = {
  /** Vrai quand la fiche est ouverte en modification. */
  actif: boolean;
  /**
   * Vrai dès qu'un panneau, n'importe lequel, porte une saisie non
   * enregistrée. Le `sale()` du registre répond à la demande, sur un tour de
   * table ; celui-ci est un ÉTAT, qui fait re-rendre ce qui le lit — c'est ce
   * qu'il faut pour faire paraître « Enregistrer » et « Annuler » à la frappe.
   */
  modifie: boolean;
  /** Vrai pendant qu'un « Enregistrer » de la fiche court. */
  occupe: boolean;
  /** Déclare un panneau au mode ; renvoie sa clé et sa radiation. */
  inscrire: (i: Inscription) => { cle: symbol; radier: () => void };
  /** Un panneau annonce qu'il vient de se salir, ou de se rendre propre. */
  signalerSale: (cle: symbol, sale: boolean) => void;
  /** Enregistre TOUS les panneaux qui portent une saisie, puis referme si tout a abouti. */
  enregistrerTout: () => Promise<void>;
  /** Rend TOUS les panneaux à leurs valeurs enregistrées et referme — le geste du crayon. */
  annulerTout: () => Promise<void>;
  /**
   * Referme le mode SI plus rien n'est en cours nulle part — `sauf` le
   * panneau désigné, qu'on ne consulte pas.
   */
  fermerSiPropre: (sauf?: symbol) => void;
};

const Contexte = createContext<ContexteModeFiche | null>(null);

/** Ce qu'un panneau reçoit du mode — nul hors d'un provider (écrans de création). */
export type ModeFiche = {
  actif: boolean;
  /** Vrai dès qu'un panneau de la fiche porte une saisie non enregistrée. */
  modifie: boolean;
  occupe: boolean;
  enregistrerTout: () => Promise<void>;
  annulerTout: () => Promise<void>;
  fermerSiPropre: () => void;
};

/**
 * Inscrit le panneau appelant au mode de la fiche, s'il y en a un — nul hors
 * d'un provider : les écrans de CRÉATION, qui n'ont ni onglets ni verrou, où
 * le panneau retombe sur son comportement propre.
 *
 * Les fonctions passées sont relues à CHAQUE appel via une ref : `sale` lit un
 * état React, et une inscription figée au premier rendu répondrait toujours
 * « non ».
 *
 * Le `fermerSiPropre` rendu EXCLUT le panneau appelant du tour de table : il
 * l'appelle juste après s'être rendu propre (reset, enregistrement), et son
 * propre « sale » inscrit répond encore avec l'état du rendu précédent — il
 * se dirait sale et tiendrait le mode ouvert à tort. Lui sait où il en est ;
 * la question ne porte que sur les AUTRES.
 */
export function useInscriptionModeFiche(inscription: Inscription): ModeFiche | null {
  const brut = useContext(Contexte);
  const ref = useRef(inscription);
  ref.current = inscription;
  const cleRef = useRef<symbol | undefined>(undefined);
  const inscrire = brut?.inscrire;

  /**
   * Le `sale` du panneau, relevé À CHAQUE RENDU et poussé au mode quand il
   * change. C'est ici et nulle part ailleurs : le hook se rejoue à chaque
   * frappe du panneau — puisque `sale` lit son état —, si bien qu'aucun panneau
   * n'a à penser à prévenir. Le mode, lui, ne se rendrait jamais compte de rien
   * : rien ne le re-rend quand un enfant tape.
   */
  const signalerSale = brut?.signalerSale;
  const idRef = useRef<symbol | undefined>(undefined);
  if (!idRef.current) idRef.current = Symbol("panneau");
  const id = idRef.current;
  const sale = inscription.sale();
  useEffect(() => {
    if (!signalerSale) return;
    signalerSale(id, sale);
    // Un panneau démonté — on change d'onglet, la fiche se referme — ne laisse
    // pas sa saleté derrière lui : elle ferait paraître les deux boutons pour
    // une saisie qui n'est plus à l'écran.
    return () => signalerSale(id, false);
  }, [signalerSale, id, sale]);

  // `enregistrer` déclaré ou non : relevé au premier rendu, il ne change pas
  // de statut en cours de vie — c'est la nature du panneau, pas son état.
  const [avecEnregistrer] = useState(() => inscription.enregistrer !== undefined);
  useEffect(() => {
    if (!inscrire) return;
    const { cle, radier } = inscrire({
      sale: () => ref.current.sale(),
      rendre: () => ref.current.rendre(),
      enregistrer: avecEnregistrer
        ? () => ref.current.enregistrer?.() ?? Promise.resolve(true)
        : undefined,
    });
    cleRef.current = cle;
    return () => {
      cleRef.current = undefined;
      radier();
    };
  }, [inscrire, avecEnregistrer]);
  return useMemo(
    () =>
      brut
        ? {
            actif: brut.actif,
            modifie: brut.modifie,
            occupe: brut.occupe,
            enregistrerTout: brut.enregistrerTout,
            annulerTout: brut.annulerTout,
            fermerSiPropre: () => brut.fermerSiPropre(cleRef.current),
          }
        : null,
    [brut],
  );
}

export function ModeFicheProvider({
  readOnly,
  objet,
  detailFermeture = "Les modifications en cours seront perdues.",
  children,
}: {
  readOnly: boolean;
  /** Complément du libellé d'ouverture : « Modifier cette fiche », « ce marché »… */
  objet: string;
  /** Détail de la question de fermeture — précisé quand la fiche a des onglets. */
  detailFermeture?: string;
  children: ReactNode;
}) {
  const confirmer = useConfirmation();
  const [actif, setActif] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const registre = useRef(new Map<symbol, Inscription>());
  /** Les panneaux qui se sont annoncés sales — voir `modifie`. */
  const [sales, setSales] = useState<ReadonlySet<symbol>>(() => new Set());
  /** Garde de réentrance : un double clic ne doit pas enregistrer deux fois. */
  const enCoursRef = useRef(false);

  const signalerSale = useCallback((cle: symbol, sale: boolean) => {
    setSales((avant) => {
      if (avant.has(cle) === sale) return avant;
      const apres = new Set(avant);
      if (sale) apres.add(cle);
      else apres.delete(cle);
      return apres;
    });
  }, []);

  const inscrire = useCallback((i: Inscription) => {
    const cle = Symbol();
    registre.current.set(cle, i);
    return {
      cle,
      radier: () => {
        registre.current.delete(cle);
      },
    };
  }, []);

  const fermerSiPropre = useCallback((sauf?: symbol) => {
    setActif((a) => {
      if (!a) return a;
      const enCours = [...registre.current.entries()].some(([cle, i]) => cle !== sauf && i.sale());
      return enCours ? a : false;
    });
  }, []);

  /**
   * « Enregistrer » de la fiche : CHAQUE panneau qui porte une saisie
   * enregistre la sienne — on modifie toute la fiche, on l'enregistre toute.
   * EN SÉQUENCE : deux actions serveur touchent parfois la même ligne, et un
   * échec doit laisser un état lisible.
   *
   * Le mode ne se referme que si tout a abouti. Un panneau en échec garde son
   * erreur affichée ; un sous-formulaire ouvert (une tâche, une pièce à
   * moitié saisies) ne peut pas être validé à la place de qui le remplit — le
   * mode reste alors ouvert, sur la saisie qui attend.
   */
  const enregistrerTout = useCallback(async () => {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    setOccupe(true);
    try {
      let toutAbouti = true;
      for (const i of registre.current.values()) {
        if (!i.sale()) continue;
        if (!i.enregistrer) {
          toutAbouti = false;
          continue;
        }
        if (!(await i.enregistrer())) toutAbouti = false;
      }
      if (toutAbouti) setActif(false);
    } finally {
      enCoursRef.current = false;
      setOccupe(false);
    }
  }, []);

  /**
   * « Annuler » de la fiche — et le second clic du crayon, qui est LE MÊME
   * geste : rend à TOUS les panneaux leurs valeurs enregistrées, puis referme.
   * Une seule confirmation, si quoi que ce soit serait perdu, n'importe où.
   */
  const annulerTout = useCallback(async () => {
    if ([...registre.current.values()].some((i) => i.sale())) {
      const ok = await confirmer({
        question: "Fermer sans enregistrer ?",
        detail: detailFermeture,
        action: "Fermer sans enregistrer",
      });
      if (!ok) return;
    }
    for (const i of registre.current.values()) i.rendre();
    setActif(false);
  }, [confirmer, detailFermeture]);

  /** Le crayon : éteint il OUVRE, allumé il referme — par `annulerTout`. */
  async function basculer() {
    if (!actif) setActif(true);
    else await annulerTout();
  }

  const valeur = useMemo(
    () => ({
      actif,
      modifie: sales.size > 0,
      occupe,
      inscrire,
      signalerSale,
      enregistrerTout,
      annulerTout,
      fermerSiPropre,
    }),
    [actif, sales, occupe, inscrire, signalerSale, enregistrerTout, annulerTout, fermerSiPropre],
  );

  return (
    <Contexte.Provider value={valeur}>
      <CommandesOnglet>
        {readOnly ? null : (
          <button
            type="button"
            onClick={basculer}
            aria-pressed={actif}
            title={actif ? "Fermer la modification" : `Modifier ${objet}`}
            aria-label={actif ? "Fermer la modification" : `Modifier ${objet}`}
            className={`btn-ghost !p-2 ${actif ? "!text-accent" : "hover:!text-accent"}`}
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}
      </CommandesOnglet>
      {children}
    </Contexte.Provider>
  );
}

/**
 * La ligne d'actions des onglets SANS formulaire propre (contacts, marchés,
 * devis, tâches, documents…) : « Quitter » tant qu'il n'y a rien à enregistrer,
 * et les DEUX issues du mode dès qu'une saisie attend quelque part — elles
 * portent la fiche entière, elles doivent donc se trouver sous chaque onglet,
 * pas seulement sous ceux qui ont un formulaire.
 *
 * Ouvrir la fiche au crayon ne les fait PAS paraître : tant qu'on n'a rien
 * touché, il n'y a rien à enregistrer ni rien à rendre, et deux boutons offerts
 * pour rien invitent à un geste qui ne fait rien. Ils paraissent à la première
 * frappe, et le crayon suffit à refermer une fiche qu'on n'a fait que relire.
 */
export function LigneActionsFiche({
  quitter,
  supprimer,
}: {
  /** Le bouton de sortie de l'onglet, rendu quand la fiche est fermée. */
  quitter: ReactNode;
  /** La corbeille de la fiche, au bout de la ligne quel que soit l'état. */
  supprimer?: ReactNode;
}) {
  const brut = useContext(Contexte);
  return (
    <div className="mt-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {brut?.actif && brut.modifie ? (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={brut.occupe}
              onClick={() => void brut.enregistrerTout()}
            >
              {brut.occupe ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="btn-warn"
              disabled={brut.occupe}
              onClick={() => void brut.annulerTout()}
            >
              Annuler
            </button>
          </>
        ) : (
          quitter
        )}
      </div>
      {supprimer}
    </div>
  );
}
