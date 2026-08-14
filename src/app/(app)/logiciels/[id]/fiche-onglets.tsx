"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ID_COMMANDES_ONGLET } from "@/components/commandes-onglet";

/**
 * Les onglets de la fiche logiciel, versés CÔTÉ CLIENT — à la différence des
 * `Onglets` du kit, qui sont des liens et rechargent la page.
 *
 * La raison est la SAISIE : tous les panneaux sont montés en permanence, et
 * changer d'onglet ne fait que masquer l'un pour montrer l'autre. Un champ à
 * moitié rempli sur la Synthèse survit donc à un détour par les Documents — là
 * où une navigation démontait le panneau et jetait la frappe sans un mot.
 * C'est ce qui rend honnête le crayon « je modifie toute la fiche » : le mode
 * embrasse les onglets, leur contenu doit leur survivre aussi.
 *
 * L'URL reste tenue à jour (`?onglet=`), par `pushState` : l'onglet courant se
 * recharge, se met en favori et se partage comme avant, et les boutons
 * précédent/suivant du navigateur retraversent les onglets visités. Ce sont de
 * vrais liens `<a>` — clic du milieu et copie d'adresse continuent de valoir —
 * dont seul le clic gauche est intercepté.
 */
export function FicheOnglets<T extends string>({
  onglets,
  initial,
  base,
  panneaux,
}: {
  onglets: ReadonlyArray<{ key: T; label: string }>;
  /** L'onglet demandé par l'URL au chargement. */
  initial: T;
  /** Adresse de la fiche, ex. « /logiciels/8 ». */
  base: string;
  /** Un panneau par clé d'onglet, rendus côté serveur et TOUS montés. */
  panneaux: Record<T, ReactNode>;
}) {
  const [actif, setActif] = useState<T>(initial);

  // Précédent/suivant du navigateur : l'URL a changé sans nous, on la suit.
  useEffect(() => {
    const suivre = () => {
      const k = new URLSearchParams(window.location.search).get("onglet");
      const connu = onglets.find((o) => o.key === k);
      setActif(connu ? connu.key : onglets[0].key);
    };
    window.addEventListener("popstate", suivre);
    return () => window.removeEventListener("popstate", suivre);
  }, [onglets]);

  function aller(e: React.MouseEvent, key: T) {
    // Modificateurs et clic du milieu : le navigateur fait son travail de lien.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    if (key === actif) return;
    window.history.pushState(null, "", `${base}?onglet=${key}`);
    setActif(key);
  }

  return (
    <>
      {/* La même silhouette que les `Onglets` du kit : mêmes classes, même
          emplacement de commandes au bout de la rangée. */}
      <div className="mb-3 flex items-end gap-1.5 border-b border-line pb-px">
        <div className="flex flex-wrap gap-1.5">
          {onglets.map((o) => (
            <a
              key={o.key}
              href={`${base}?onglet=${o.key}`}
              onClick={(e) => aller(e, o.key)}
              aria-current={o.key === actif ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition ${
                o.key === actif
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-strong"
              }`}
            >
              {o.label}
            </a>
          ))}
        </div>
        <div id={ID_COMMANDES_ONGLET} className="ml-auto flex shrink-0 items-center gap-1" />
      </div>

      {/* `hidden` et non un démontage : c'est tout l'objet de ce composant. */}
      {onglets.map((o) => (
        <div key={o.key} hidden={o.key !== actif}>
          {panneaux[o.key]}
        </div>
      ))}
    </>
  );
}
