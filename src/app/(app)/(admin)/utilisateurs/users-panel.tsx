"use client";

import { KeyRound, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import {
  createUserAction,
  deleteUserAction,
  reset2faAction,
  sendResetAction,
  updateUserAction,
} from "./actions";

export type UserRow = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
  ldap: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  estMoi: boolean;
};

export function UsersPanel({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [enEdition, setEnEdition] = useState<UserRow | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Erreur." });
      if (res.ok) router.refresh();
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(
      () => (enEdition ? updateUserAction(enEdition.id, form) : createUserAction(form)),
      enEdition
        ? "Compte mis à jour."
        : "Compte créé — un lien « définir mon mot de passe » a été envoyé.",
    );
    if (!enEdition) setFormVisible(false);
    setEnEdition(null);
  }

  return (
    <div className="space-y-6">
      {msg ? <p className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p> : null}

      <Card
        title={`Comptes (${users.length})`}
        actions={
          <button
            type="button"
            className="btn-secondary !py-1.5"
            onClick={() => {
              setEnEdition(null);
              setFormVisible((v) => !v);
            }}
          >
            {formVisible && !enEdition ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formVisible && !enEdition ? "Fermer" : "Créer un compte"}
          </button>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Rôle</th>
                <th>Origine</th>
                <th>Dernière connexion</th>
                <th className="w-36" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="font-medium text-strong">
                      {`${u.prenom} ${u.nom}`.trim() || u.email}
                      {u.estMoi ? <span className="badge-accent ml-2">vous</span> : null}
                    </span>
                    <span className="block text-xs text-faint">{u.email}</span>
                  </td>
                  <td>
                    <span className={u.role === "admin" ? "badge-accent" : "badge-muted"}>
                      {u.role === "admin" ? "Administrateur" : "Lecteur"}
                    </span>
                  </td>
                  <td>
                    {u.ldap ? (
                      <span className="badge-info">annuaire</span>
                    ) : (
                      <span className="badge-muted">local</span>
                    )}
                    {u.twoFactorEnabled ? <span className="badge-ok ml-1">2FA</span> : null}
                  </td>
                  <td className="text-xs text-muted">{u.lastLoginAt ?? "jamais"}</td>
                  <td>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost !p-2"
                        title="Modifier"
                        disabled={pending}
                        onClick={() => {
                          setEnEdition(u);
                          setFormVisible(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {u.ldap ? null : (
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Envoyer un lien de réinitialisation du mot de passe"
                          disabled={pending}
                          onClick={() =>
                            run(() => sendResetAction(u.id), `Lien envoyé à ${u.email}.`)
                          }
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      {u.twoFactorEnabled ? (
                        <button
                          type="button"
                          className="btn-ghost !p-2"
                          title="Réinitialiser la double authentification"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Retirer le second facteur de ${u.email} ?`))
                              run(() => reset2faAction(u.id), "Double authentification retirée.");
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      ) : null}
                      {u.estMoi ? null : (
                        <button
                          type="button"
                          className="btn-ghost !p-2 hover:!text-danger"
                          title="Supprimer le compte"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Supprimer le compte de ${u.email} ?`))
                              run(() => deleteUserAction(u.id), "Compte supprimé.");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {formVisible ? (
        <Card title={enEdition ? `Modifier ${enEdition.email}` : "Nouveau compte"}>
          <form
            key={enEdition ? `edit-${enEdition.id}` : "new"}
            onSubmit={submit}
            className="grid gap-4 sm:grid-cols-2"
          >
            {enEdition ? null : (
              <Field
                label="Adresse e-mail"
                htmlFor="email"
                required
                hint="L'agent recevra un lien pour définir son mot de passe."
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={pending}
                  className="input"
                  placeholder="prenom.nom@collectivite.fr"
                />
              </Field>
            )}
            <Field label="Rôle" htmlFor="role">
              <select
                id="role"
                name="role"
                defaultValue={enEdition?.role ?? "lecteur"}
                disabled={pending}
                className="input"
              >
                <option value="lecteur">Lecteur (consultation)</option>
                <option value="admin">Administrateur (gestion complète)</option>
              </select>
            </Field>
            <Field label="Prénom" htmlFor="prenom">
              <input
                id="prenom"
                name="prenom"
                defaultValue={enEdition?.prenom ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Nom" htmlFor="nom">
              <input
                id="nom"
                name="nom"
                defaultValue={enEdition?.nom ?? ""}
                disabled={pending}
                className="input"
              />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Enregistrement…" : enEdition ? "Enregistrer" : "Créer le compte"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => {
                  setEnEdition(null);
                  setFormVisible(false);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
