"use client";

import { useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { saveMailConfigAction, saveRappelsConfigAction, sendTestMailAction } from "./actions";

type Config = {
  from: string;
  fromName: string;
  host: string;
  port: string;
  security: string;
  username: string;
  passwordDefini: boolean;
  tacheJours: string;
  contratJours: string;
  destinataires: string;
};

export function ReglagesPanel({ config }: { config: Config }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Erreur." });
    });
  }

  return (
    <div className="space-y-3">
      {msg ? <p className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p> : null}

      <Card title="Serveur SMTP">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveMailConfigAction(new FormData(e.currentTarget as HTMLFormElement)),
              "Réglages SMTP enregistrés.",
            );
          }}
          className="grid gap-x-3 gap-y-2 sm:grid-cols-2"
        >
          <Field label="Hôte" htmlFor="host" hint="Vide = variable SMTP_HOST.">
            <input
              id="host"
              name="host"
              placeholder="smtp.collectivite.fr"
              defaultValue={config.host}
              disabled={pending}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Port" htmlFor="port">
              <input
                id="port"
                name="port"
                type="number"
                defaultValue={config.port}
                disabled={pending}
                className="input"
                placeholder="587"
              />
            </Field>
            <Field label="Sécurité" htmlFor="security">
              <select
                id="security"
                name="security"
                defaultValue={config.security}
                disabled={pending}
                className="input"
              >
                <option value="">Aucune</option>
                <option value="tls">STARTTLS</option>
                <option value="ssl">SSL</option>
              </select>
            </Field>
          </div>
          <Field label="Identifiant" htmlFor="username">
            <input
              id="username"
              name="username"
              defaultValue={config.username}
              disabled={pending}
              className="input"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Mot de passe"
            htmlFor="password"
            hint={
              config.passwordDefini
                ? "Un mot de passe est enregistré (chiffré). Laisser vide pour le conserver."
                : "Aucun mot de passe enregistré."
            }
          >
            <input
              id="password"
              name="password"
              type="password"
              disabled={pending}
              className="input"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Adresse d'expéditeur" htmlFor="from">
            <input
              id="from"
              name="from"
              type="email"
              defaultValue={config.from}
              disabled={pending}
              className="input"
              placeholder="no-reply@collectivite.fr"
            />
          </Field>
          <Field label="Nom d'expéditeur" htmlFor="fromName">
            <input
              id="fromName"
              name="fromName"
              defaultValue={config.fromName}
              disabled={pending}
              className="input"
              placeholder="SoftInventory"
            />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Enregistrement…" : "Enregistrer les réglages SMTP"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Test d'envoi">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => sendTestMailAction(new FormData(e.currentTarget as HTMLFormElement)),
              "E-mail de test envoyé — vérifiez la boîte de réception.",
            );
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-64">
            <Field label="Destinataire" htmlFor="to" hint="Vide = votre propre adresse.">
              <input id="to" name="to" type="email" disabled={pending} className="input" />
            </Field>
          </div>
          <button type="submit" disabled={pending} className="btn-secondary">
            {pending ? "Envoi…" : "Envoyer un test"}
          </button>
        </form>
      </Card>

      <Card title="Rappels d'échéances">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveRappelsConfigAction(new FormData(e.currentTarget as HTMLFormElement)),
              "Réglages des rappels enregistrés.",
            );
          }}
          className="grid gap-x-3 gap-y-2 sm:grid-cols-2"
        >
          <Field
            label="Rappel des tâches (jours avant)"
            htmlFor="tacheJours"
            hint="Chaque tâche peut définir son propre délai."
          >
            <input
              id="tacheJours"
              name="tacheJours"
              type="number"
              min={0}
              max={365}
              defaultValue={config.tacheJours}
              disabled={pending}
              className="input"
            />
          </Field>
          <Field label="Rappel des contrats (jours avant)" htmlFor="contratJours">
            <input
              id="contratJours"
              name="contratJours"
              type="number"
              min={0}
              max={365}
              defaultValue={config.contratJours}
              disabled={pending}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Destinataires par défaut"
              htmlFor="destinataires"
              hint="Adresses (séparées par des virgules) prévenues quand une tâche n'est assignée à personne, et pour tous les rappels de contrats."
            >
              <input
                id="destinataires"
                name="destinataires"
                defaultValue={config.destinataires}
                disabled={pending}
                className="input"
                placeholder="dsi@collectivite.fr"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Enregistrement…" : "Enregistrer les rappels"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
