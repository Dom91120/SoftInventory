"use client";

import { Plus, Trash2, X } from "lucide-react";
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
  /** Zone de rattachement dépliée, comme le formulaire des pièces juste dessous. */
  const [ouvert, setOuvert] = useState(false);

  function fermer() {
    setOuvert(false);
    setChoix("");
  }

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
    <Card
      title="Logiciels couverts"
      // Le geste monte dans l'en-tête, comme « Ajouter une pièce » de la carte
      // voisine : il porte sur la CARTE, pas sur une de ses lignes, et la liste
      // n'a plus un champ de saisie collé sous elle en permanence.
      actions={
        readOnly || disponibles.length === 0 ? undefined : (
          <button
            type="button"
            className="btn-secondary !py-1.5"
            disabled={pending}
            onClick={() => (ouvert ? fermer() : setOuvert(true))}
          >
            {ouvert ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {ouvert ? "Fermer" : "Rattacher"}
          </button>
        )
      }
    >
      {error ? <p className="alert-error mb-3">{error}</p> : null}

      {/* La zone se déplie AU-DESSUS de la liste, à l'endroit où le logiciel
          choisi viendra s'inscrire. */}
      {ouvert ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-sub bg-inset p-4">
          <select
            // biome-ignore lint/a11y/noAutofocus: la zone vient d'être ouverte par un clic délibéré sur « Rattacher ».
            autoFocus
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
          {/* Plein comme un « Enregistrer », et grisé pour la même raison que
              lui — l'enregistrement en cours — et pour elle seule. Un bouton
              désactivé parce qu'un champ est vide se lit comme une commande
              hors service ; celui-ci répond, et dit ce qui manque. */}
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => {
              if (!choix) {
                setError("Choisissez d'abord un logiciel dans la liste.");
                return;
              }
              run(() => attacherLogicielAction(contratId, Number(choix)), fermer);
            }}
          >
            {pending ? "Rattachement…" : "Rattacher"}
          </button>
          <button type="button" className="btn-warn" disabled={pending} onClick={fermer}>
            Annuler
          </button>
        </div>
      ) : null}

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

      {/* Plus de bouton dans l'en-tête quand il n'y a plus rien à rattacher :
          la carte le dit en clair plutôt que de laisser une commande sans
          effet. */}
      {readOnly || disponibles.length > 0 ? null : (
        <p className="text-sm text-faint">
          Tous les logiciels de l'inventaire sont déjà rattachés à ce marché.
        </p>
      )}
    </Card>
  );
}
