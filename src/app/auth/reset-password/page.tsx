"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password";
import { useFormSubmit } from "@/lib/use-form-submit";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { pending, error, onSubmit } = useFormSubmit();

  const submit = onSubmit(async (form) => {
    const pwd = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (pwd !== confirm) return "Les deux mots de passe ne correspondent pas.";
    if (!token) return "Lien invalide ou incomplet : refaites une demande de réinitialisation.";
    const res = await authClient.resetPassword({ newPassword: pwd, token });
    if (res.error) {
      return (
        res.error.message ??
        "Lien expiré ou déjà utilisé : refaites une demande de réinitialisation."
      );
    }
    router.replace("/auth/login");
  });

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-2xl">
      <h1 className="mb-3 text-lg font-semibold tracking-tight text-strong">
        Nouveau mot de passe
      </h1>
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Nouveau mot de passe"
          htmlFor="password"
          required
          hint={PASSWORD_POLICY_MESSAGE}
        >
          <input
            id="password"
            name="password"
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
        {error ? <p className="alert-error">{error}</p> : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Enregistrement…" : "Définir le mot de passe"}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-muted">
        <Link href="/auth/login" className="underline hover:text-accent">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams impose une frontière Suspense au build.
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
