"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { attacherLogicielAction, detacherLogicielAction } from "./actions";

/**
 * Logiciels couverts par un marché : la liste des rattachés, et de quoi en
 * ajouter un. Même forme que la carte « Serveurs d'installation » de l'onglet
 * Liaisons, et pour la même raison — 87 cases à cocher pour désigner deux
 * logiciels noyaient la fiche, et 85 d'entre elles ne disaient rien.
 *
 * Les deux gestes s'appliquent AU CLIC, hors du bouton Enregistrer du marché :
 * un rattachement est un lien, pas un champ de formulaire.
 */
export function LogicielsCouverts({
  contratId,
  rattaches,
  disponibles,
  readOnly,
}: {
  contratId: number;
  rattaches: Array<{ id: number; nom: string }>;
  /** Le reste de l'inventaire : ce qu'on peut encore rattacher. */
  disponibles: Array<{ id: number; nom: string }>;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choix, setChoix] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, apres?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Une erreur est survenue.");
        return;
      }
      apres?.();
      router.refresh();
    });
  }

  return (
    <Card title="Logiciels couverts">
      {error ? <p className="alert-error mb-3">{error}</p> : null}

      {rattaches.length === 0 ? (
        <p className="mb-3 text-sm text-faint">
          Aucun logiciel rattaché. Un marché peut précéder l'inventaire de ce qu'il couvre.
        </p>
      ) : (
        <ul className="mb-3 divide-y divide-line text-sm">
          {rattaches.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={`/logiciels/${l.id}?onglet=contrats`}
                className="min-w-0 truncate font-medium text-strong hover:text-accent"
              >
                {l.nom}
              </Link>
              {readOnly ? null : (
                <button
                  type="button"
                  className="btn-ghost !p-2 shrink-0 hover:!text-danger"
                  title={`Détacher ${l.nom} de ce marché`}
                  disabled={pending}
                  onClick={() => run(() => detacherLogicielAction(contratId, l.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {readOnly ? null : disponibles.length === 0 ? (
        <p className="text-sm text-faint">
          Tous les logiciels de l'inventaire sont déjà rattachés à ce marché.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input !w-auto"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            disabled={pending}
            aria-label="Logiciel à rattacher"
          >
            <option value="">Choisir un logiciel…</option>
            {disponibles.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending || !choix}
            onClick={() =>
              run(
                () => attacherLogicielAction(contratId, Number(choix)),
                () => setChoix(""),
              )
            }
          >
            <Plus className="h-4 w-4" />
            Rattacher
          </button>
        </div>
      )}
    </Card>
  );
}
