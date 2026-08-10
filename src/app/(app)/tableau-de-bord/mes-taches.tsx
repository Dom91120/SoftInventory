"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ModaleTache, type TacheDetail } from "@/components/modale-tache";
import { Card } from "@/components/ui";

export type MaTache = {
  id: number;
  logicielId: number;
  logiciel: string;
  echeance: Date;
  enRetard: boolean;
  detail: TacheDetail;
};

const FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Les tâches assignées à celui qui regarde — la seule carte du tableau de bord
 * qui change d'un compte à l'autre.
 *
 * Chaque partie d'une ligne mène où son texte le dit : le TITRE ouvre la fiche
 * de la tâche en lecture, le LOGICIEL sa fiche à lui, le titre de la carte la
 * liste des tâches du parc. Trois destinations pour trois libellés, plutôt
 * qu'une ligne entière qui mènerait quelque part sans dire où.
 *
 * Composant client : la modale a besoin d'un état, le reste de l'écran non.
 */
export function MesTaches({ taches }: { taches: MaTache[] }) {
  const [detail, setDetail] = useState<TacheDetail | null>(null);

  return (
    <>
      <Card
        // Le titre mène à la MÊME liste, en grand : la page des tâches filtrée
        // sur celles qui me sont assignées. Y envoyer sans le filtre aurait
        // ouvert une liste plus large que celle qu'on venait de cliquer.
        title={
          <Link
            href="/taches?assignation=moi"
            className="transition hover:text-accent"
            title="Voir toutes mes tâches"
          >
            Mes tâches
          </Link>
        }
        className="lg:col-span-2"
      >
        <ul className="divide-y divide-line text-sm">
          {taches.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <button
                  type="button"
                  className="block max-w-full truncate text-left font-medium text-strong hover:text-accent"
                  title={`Voir « ${t.detail.titre} »`}
                  onClick={() => setDetail(t.detail)}
                >
                  {t.detail.titre}
                </button>
                <Link
                  href={`/logiciels/${t.logicielId}`}
                  className="block truncate text-muted text-xs transition hover:text-accent"
                  title={`Ouvrir la fiche de ${t.logiciel}`}
                >
                  {t.logiciel}
                </Link>
              </span>
              {/* Rouge pour un retard, ambre pour ce qui vient : la charte donne
                  à l'ambre le sens d'« échéance proche ». */}
              <span className={t.enRetard ? "badge-danger shrink-0" : "badge-warn shrink-0"}>
                <CalendarClock className="h-3.5 w-3.5" />
                {FMT.format(t.echeance)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {detail ? <ModaleTache tache={detail} onFermer={() => setDetail(null)} /> : null}
    </>
  );
}
