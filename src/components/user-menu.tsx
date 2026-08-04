"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Menu de l'usager, en pied de barre latérale : le bloc d'identité en est le
 * bouton, et le panneau se déploie au-dessus.
 *
 * Bâti sur un `<details>` natif — comme la navigation mobile — pour n'avoir ni
 * état à porter ni panneau à ouvrir soi-même. Le seul JS ici sert à ce que le
 * balisage ne sait pas faire : refermer sur un clic à l'extérieur, ou sur
 * Échap. C'est aussi la raison d'être de ce composant client, le reste du pied
 * restant rendu sur le serveur.
 */
export function UserMenu({
  initiales,
  nomAffiche,
  role,
}: {
  initiales: string;
  nomAffiche: string;
  role: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function fermerSiDehors(e: PointerEvent) {
      const d = ref.current;
      // `contains` couvre le résumé ET le panneau : un clic sur un élément du
      // menu ne le referme donc pas par ce chemin (le lien s'en charge).
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    }
    function fermerSiEchap(e: KeyboardEvent) {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    }
    // `pointerdown` plutôt que `click` : le menu se referme dès l'appui, sans
    // attendre le relâchement — et l'élément visé reste cliquable du même geste.
    document.addEventListener("pointerdown", fermerSiDehors);
    document.addEventListener("keydown", fermerSiEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiDehors);
      document.removeEventListener("keydown", fermerSiEchap);
    };
  }, []);

  // La navigation est côté client : le composant survit au changement de page
  // et le menu resterait ouvert derrière l'écran suivant.
  const fermer = () => {
    if (ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className="group relative">
      {/* Aucune marge négative : la boîte de survol garde les 12 px du `p-3` du
          pied de chaque côté, bordure droite égale à la gauche. Les deux
          boutons de la barre flottent par-dessus, ils ne la déforment pas. */}
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-inset [&::-webkit-details-marker]:hidden">
        <span
          className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))",
          }}
        >
          {initiales}
        </span>
        {/* `pr-16` sur la ligne du NOM seulement : les boutons flottent au-dessus
            d'elle, le nom passerait dessous sans cette réserve. Le rôle, lui, la
            déborde volontairement — il réclame 109 px pour ~105 disponibles, et
            s'affiche en entier dans l'espace laissé libre sous les boutons, qui
            sont relevés. Le tronquer donnerait « ADMINIST… ». */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 pr-16">
            <span className="min-w-0 truncate text-sm font-medium text-strong">{nomAffiche}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint transition group-open:rotate-180" />
          </span>
          <span className="block text-[0.64rem] font-bold uppercase tracking-[0.13em] text-faint">
            {role}
          </span>
        </span>
      </summary>
      {/* Se déploie VERS LE HAUT et par-dessus le contenu : `bottom-full` le pose
          sur le bord supérieur du <details>, `absolute` l'ôte du flux pour qu'il
          recouvre la navigation au lieu de la pousser. Un pied de barre n'a pas
          de place sous lui.

          `mb-3` et non `mb-1` : les deux boutons sont relevés de 8 px au-dessus
          du <details>, si bien qu'un écart de 4 px laissait le menu passer sous
          eux — et ils sont au-dessus dans l'ordre d'empilement, d'où un coin
          rogné. 12 px les dégagent franchement.

          Fond opaque et ombre portée obligatoires : sans eux, la navigation
          resterait lisible au travers. */}
      <div className="absolute inset-x-0 bottom-full z-20 mb-3 rounded-lg border border-line bg-surface p-1 shadow-lg">
        <Link
          href="/mon-compte"
          onClick={fermer}
          className="block rounded-md px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-strong"
        >
          Mon compte
        </Link>
        <Link
          href="/readme"
          onClick={fermer}
          className="block rounded-md px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-strong"
        >
          README
        </Link>
      </div>
    </details>
  );
}
