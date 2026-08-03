"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password";
import { useFormSubmit } from "@/lib/use-form-submit";

export function PasswordForm() {
  const { pending, error, onSubmit } = useFormSubmit();
  const [done, setDone] = useState(false);

  const submit = onSubmit(async (form) => {
    setDone(false);
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (next !== confirm) return "Les deux nouveaux mots de passe ne correspondent pas.";
    // `revokeOtherSessions` est de toute façon FORCÉ côté serveur (hook auth.ts).
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    if (res.error) return res.error.message ?? "Mot de passe actuel incorrect.";
    setDone(true);
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Mot de passe actuel" htmlFor="current" required>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nouveau mot de passe" htmlFor="next" required hint={PASSWORD_POLICY_MESSAGE}>
          <input
            id="next"
            name="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            className="input"
          />
        </Field>
        <Field label="Confirmation" htmlFor="confirm" required>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="input"
          />
        </Field>
      </div>
      {error ? <p className="alert-error">{error}</p> : null}
      {done ? (
        <p className="alert-success">
          Mot de passe modifié. Vos autres sessions ont été déconnectées.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Modification…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
