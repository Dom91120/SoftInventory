"use client";

import { PlugZap } from "lucide-react";
import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { save2faAction, saveLdapConfigAction, testLdapAction } from "./actions";

type Config = {
  actif: boolean;
  url: string;
  baseDn: string;
  bindDn: string;
  bindPasswordDefini: boolean;
  filtreUtilisateur: string;
  groupeAdmin: string;
  groupeLecteur: string;
  exiger2fa: boolean;
};

export function AuthPanel({ config }: { config: Config }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; detail?: string }>,
    okText: string,
  ) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(
        res.ok
          ? { ok: true, text: res.detail ? `${okText} ${res.detail}` : okText }
          : { ok: false, text: res.error ?? "Erreur." },
      );
    });
  }

  return (
    <div className="space-y-3">
      {msg ? <p className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p> : null}

      <Card
        title="Annuaire LDAP / Active Directory"
        actions={
          <button
            type="button"
            className="btn-secondary !px-2.5 !py-1 !text-xs"
            disabled={pending}
            onClick={() => run(() => testLdapAction(), "")}
          >
            <PlugZap className="h-3.5 w-3.5" />
            Tester la connexion
          </button>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Quand l'annuaire est actif, les agents se connectent avec leur identifiant Windows
          (sAMAccountName, UPN ou adresse) : le compte est créé/synchronisé automatiquement, le rôle
          découle des groupes ci-dessous. Les comptes locaux (dont l'admin de secours) continuent de
          fonctionner, y compris si l'annuaire est en panne.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveLdapConfigAction(new FormData(e.currentTarget as HTMLFormElement)),
              "Réglages LDAP enregistrés.",
            );
          }}
          className="grid gap-x-3 gap-y-2 sm:grid-cols-2"
        >
          <label className="flex items-center gap-3 text-sm font-medium text-body sm:col-span-2">
            <input
              type="checkbox"
              name="actif"
              defaultChecked={config.actif}
              disabled={pending}
              className="h-4 w-4 accent-(--color-accent)"
            />
            Activer l'authentification par l'annuaire
          </label>
          {/* L'exemple passe en placeholder, la recommandation reste en aide :
              elle doit se lire même une fois l'URL saisie. */}
          <Field label="URL du serveur" htmlFor="url" hint="ldaps:// recommandé ; ldap:// accepté.">
            <input
              id="url"
              name="url"
              placeholder="ldaps://dc.ville.local:636"
              defaultValue={config.url}
              disabled={pending}
              className="input font-mono text-xs"
            />
          </Field>
          <Field label="Base DN" htmlFor="baseDn" hint="Racine de recherche.">
            <input
              id="baseDn"
              name="baseDn"
              placeholder="DC=ville,DC=local"
              defaultValue={config.baseDn}
              disabled={pending}
              className="input font-mono text-xs"
            />
          </Field>
          <Field
            label="Compte de service (DN)"
            htmlFor="bindDn"
            hint="Compte en lecture seule pour chercher les utilisateurs ; vide = recherche anonyme."
          >
            <input
              id="bindDn"
              name="bindDn"
              defaultValue={config.bindDn}
              disabled={pending}
              className="input font-mono text-xs"
            />
          </Field>
          <Field
            label="Mot de passe du compte de service"
            htmlFor="bindPassword"
            hint={
              config.bindPasswordDefini
                ? "Enregistré (chiffré). Laisser vide pour le conserver."
                : "Aucun mot de passe enregistré."
            }
          >
            <input
              id="bindPassword"
              name="bindPassword"
              type="password"
              disabled={pending}
              className="input"
              autoComplete="new-password"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Filtre de recherche"
              htmlFor="filtreUtilisateur"
              hint="{login} est remplacé par la saisie de l'agent."
            >
              <input
                id="filtreUtilisateur"
                name="filtreUtilisateur"
                defaultValue={config.filtreUtilisateur}
                disabled={pending}
                className="input font-mono text-xs"
              />
            </Field>
          </div>
          <Field
            label="Groupe → Administrateur"
            htmlFor="groupeAdmin"
            hint="DN complet ou fragment."
          >
            <input
              id="groupeAdmin"
              name="groupeAdmin"
              placeholder="CN=DSI-SoftInventory-Admins"
              defaultValue={config.groupeAdmin}
              disabled={pending}
              className="input font-mono text-xs"
            />
          </Field>
          <Field
            label="Groupe → Lecteur"
            htmlFor="groupeLecteur"
            hint="Vide = tout utilisateur trouvé dans l'annuaire est lecteur."
          >
            <input
              id="groupeLecteur"
              name="groupeLecteur"
              defaultValue={config.groupeLecteur}
              disabled={pending}
              className="input font-mono text-xs"
            />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Enregistrement…" : "Enregistrer les réglages LDAP"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Double authentification">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => save2faAction(new FormData(e.currentTarget as HTMLFormElement)),
              "Réglage enregistré.",
            );
          }}
          className="space-y-3"
        >
          <label className="flex items-center gap-3 text-sm font-medium text-body">
            <input
              type="checkbox"
              name="exiger2fa"
              defaultChecked={config.exiger2fa}
              disabled={pending}
              className="h-4 w-4 accent-(--color-accent)"
            />
            Exiger la double authentification (TOTP) des administrateurs
          </label>
          <p className="text-xs text-faint">
            À l'activation, les administrateurs sans second facteur sont redirigés vers leur
            enrôlement (Mon compte › Sécurité) à l'entrée des écrans d'administration — jamais
            bloqués à la connexion.
          </p>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </Card>
    </div>
  );
}
