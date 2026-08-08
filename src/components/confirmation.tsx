"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Confirmation d'un geste irréversible, DANS la page.
 *
 * `window.confirm` a été abandonné : le navigateur peut refuser de l'afficher —
 * Chrome propose « Empêcher cette page de créer des boîtes de dialogue » dès la
 * deuxième d'affilée, et les navigateurs embarqués les suppriment d'office. Il
 * renvoie alors `false` sans rien montrer, et TOUTES les corbeilles de
 * l'application deviennent silencieusement inopérantes : le geste ne fait rien,
 * sans le moindre message. C'est un mode de panne invisible, et il s'est
 * produit.
 *
 * Un `<dialog>` natif ne dépend de personne : il est modal (le reste de la page
 * devient inerte), il piège le focus, Échap le ferme, et il s'habille comme le
 * reste de l'application, en clair comme en sombre.
 *
 * L'API garde la FORME de `window.confirm` — une question, une réponse booléenne
 * — pour que les appels restent lisibles :
 *
 *     if (!(await confirmer({ question: "Supprimer « X » ?" }))) return;
 */
export type DemandeConfirmation = {
  /** La question, en titre. Se termine par un point d'interrogation. */
  question: string;
  /**
   * Ce que le geste emporte VRAIMENT, quand ce n'est pas évident : les fichiers
   * effacés avec la ligne, les écrans épargnés. Les retours à la ligne sont
   * conservés à l'affichage. Une phrase, le plus souvent ; du JSX quand un mot
   * doit peser plus lourd que les autres.
   */
  detail?: React.ReactNode;
  /** Libellé du bouton qui confirme — le VERBE du geste, jamais « OK ». */
  action?: string;
  /**
   * Bouton rouge. Vrai par défaut : on ne demande à confirmer que ce qui
   * détruit. Le passer à faux pour un geste qui se défait (un détachement).
   */
  danger?: boolean;
};

/**
 * Le détail des trois corbeilles qui emportent un fichier — une pièce de
 * marché, un devis, un document. Le nom du fichier est déjà dans la question ;
 * ce qu'il reste à dire, c'est qu'aucune corbeille ne le rattrapera, et ce
 * mot-là pèse plus lourd que les autres.
 */
export const DETAIL_FICHIER_DEFINITIF = (
  <>
    Le fichier sera <strong className="font-semibold text-strong">définitivement</strong> supprimé.
  </>
);

const Contexte = createContext<((d: DemandeConfirmation) => Promise<boolean>) | null>(null);

/**
 * Demande confirmation et attend la réponse. La promesse se résout toujours —
 * une promesse abandonnée laisserait l'appelant bloqué dans son `await`, donc
 * son bouton désactivé pour de bon.
 */
export function useConfirmation() {
  const confirmer = useContext(Contexte);
  if (!confirmer) {
    throw new Error("useConfirmation() hors de <ConfirmationProvider> : voir le layout de (app).");
  }
  return confirmer;
}

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  // Le `resolve` de la promesse en cours, gardé hors du state : le rendu n'en
  // dépend pas, et le passer par useState provoquerait un tour de plus.
  const resoudre = useRef<((ok: boolean) => void) | null>(null);
  const dialogue = useRef<HTMLDialogElement>(null);

  const confirmer = useCallback((d: DemandeConfirmation) => {
    // Deux demandes qui se chevauchent ne devraient pas arriver — le dialogue
    // est modal. Si cela se produit malgré tout, la première est refusée plutôt
    // qu'oubliée : son appelant reprend la main.
    resoudre.current?.(false);
    setDemande(d);
    return new Promise<boolean>((res) => {
      resoudre.current = res;
    });
  }, []);

  // `showModal()` APRÈS le rendu : il rend le reste de la page inerte et pose le
  // focus, deux choses qui exigent que le dialogue et son contenu soient dans le
  // document.
  useEffect(() => {
    const el = dialogue.current;
    if (el && demande && !el.open) el.showModal();
  }, [demande]);

  const repondre = useCallback((ok: boolean) => {
    resoudre.current?.(ok);
    resoudre.current = null;
    dialogue.current?.close();
    setDemande(null);
  }, []);

  return (
    <Contexte.Provider value={confirmer}>
      {children}
      {/* `onCancel` couvre la touche Échap, que le navigateur traite lui-même :
          sans lui, le dialogue se fermerait en laissant la promesse en suspens.
          Le clic sur le fond fait de même — `dialog` reçoit l'événement quand on
          vise sa zone de recouvrement, jamais quand on vise son contenu. */}
      <dialog
        ref={dialogue}
        // Échap traité NOUS-MÊMES, sans se reposer sur la fermeture native du
        // <dialog> : elle ne se déclenche pas dans tous les navigateurs
        // embarqués, et le dialogue y resterait ouvert sur une promesse en
        // suspens — le bouton d'origine désactivé pour de bon. `onCancel`
        // reste, pour le cas où le navigateur agit le premier ; les deux
        // chemins mènent à `repondre`, qui ne répond qu'une fois.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            repondre(false);
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          repondre(false);
        }}
        onClick={(e) => {
          if (e.target === dialogue.current) repondre(false);
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-body shadow-xl backdrop:bg-black/40"
      >
        {demande ? (
          <div className="p-5">
            <h2 className="text-base font-semibold text-strong">{demande.question}</h2>
            {/* `whitespace-pre-line` : les détails gardent les retours à la ligne
                de leur rédaction, comme du temps de window.confirm. */}
            {demande.detail ? (
              <p className="mt-2 whitespace-pre-line text-sm text-muted">{demande.detail}</p>
            ) : null}
            {/* « Annuler » EN PREMIER dans le DOM : le dialogue pose le focus sur
                le premier élément focalisable, et une pression sur Entrée par
                réflexe ne doit pas détruire. Il reste à gauche, le geste à
                droite — l'ordre de lecture habituel d'une validation. */}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-warn" onClick={() => repondre(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={demande.danger === false ? "btn-primary" : "btn-danger"}
                onClick={() => repondre(true)}
              >
                {demande.action ?? "Supprimer"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </Contexte.Provider>
  );
}
