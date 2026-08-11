import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui";

export type TacheAFaire = {
  id: number;
  logicielId: number;
  logiciel: string;
  titre: string;
  /** Qui s'en charge — un compte de l'app ou un nom libre. "" si personne. */
  assigne: string;
  echeance: Date;
  enRetard: boolean;
};

const FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Les tâches actives du parc, la plus proche en tête — donc les retards
 * d'abord. Celles de TOUT LE MONDE : le tableau de bord décrit le parc, et une
 * tâche en retard chez un collègue absent est un problème pour tous.
 *
 * Chaque ligne dit QUI s'en charge, faute de quoi la liste ne serait qu'un
 * empilement de titres sans savoir vers qui se tourner.
 *
 * Chaque partie d'une ligne mène où son texte le dit : le TITRE va la traiter
 * là où elle vit, l'onglet Tâches de son logiciel — c'est de là qu'on la
 * modifie ou qu'on la coche faite. Le LOGICIEL mène à sa fiche, le titre de la
 * carte à la liste complète des tâches. Trois destinations pour trois libellés,
 * plutôt qu'une ligne entière qui mènerait quelque part sans dire où.
 */
export function TachesAFaire({ taches }: { taches: TacheAFaire[] }) {
  return (
    <Card
      // Le titre mène à la MÊME liste, en grand, et sans filtre : la carte
      // n'en applique aucun non plus.
      title={
        <Link
          href="/taches"
          className="transition hover:text-accent"
          title="Voir toutes les tâches"
        >
          Tâches à faire
        </Link>
      }
      className="lg:col-span-2"
    >
      <ul className="divide-y divide-line text-sm">
        {taches.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <Link
                href={`/logiciels/${t.logicielId}?onglet=taches`}
                className="block max-w-full truncate text-left font-medium text-strong transition hover:text-accent"
                title={`Voir « ${t.titre} » dans les tâches de ${t.logiciel}`}
              >
                {t.titre}
              </Link>
              {/* Le logiciel reste un lien, la personne n'en est pas un : elle
                  n'a pas de fiche où aller. Les deux sur la même ligne, séparés
                  du point médian de l'application. */}
              <span className="block truncate text-muted text-xs">
                <Link
                  href={`/logiciels/${t.logicielId}`}
                  className="transition hover:text-accent"
                  title={`Ouvrir la fiche de ${t.logiciel}`}
                >
                  {t.logiciel}
                </Link>
                {t.assigne ? ` · ${t.assigne}` : " · non assignée"}
              </span>
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
  );
}
