"use client";

import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useFormSubmit } from "@/lib/use-form-submit";

export default function ForgotPasswordPage() {
  const { pending, error, onSubmit } = useFormSubmit();
  const [sent, setSent] = useState(false);

  const submit = onSubmit(async (form) => {
    const email = String(form.get("email") ?? "").trim();
    if (!email) return "Saisissez votre adresse e-mail.";
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password",
    });
    // Réponse identique que le compte existe ou non : ne renseigne pas un tiers
    // sur les adresses présentes en base.
    setSent(true);
  });

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-2xl">
      <h1 className="mb-3 text-lg font-semibold tracking-tight text-strong">Mot de passe oublié</h1>
      {sent ? (
        <p className="alert-success">
          Si un compte existe pour cette adresse, un e-mail de réinitialisation vient de lui être
          envoyé. Pensez à vérifier vos courriers indésirables.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Adresse e-mail" htmlFor="email" required>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
              placeholder="prenom.nom@collectivite.fr"
            />
          </Field>
          {error ? <p className="alert-error">{error}</p> : null}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
          </button>
        </form>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        <Link href="/auth/login" className="underline hover:text-accent">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
