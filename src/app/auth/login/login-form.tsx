"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";
import { signIn } from "@/lib/auth-client";
import { useFormSubmit } from "@/lib/use-form-submit";

export function LoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const { pending, error, onSubmit } = useFormSubmit();

  const submit = onSubmit(async (form) => {
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return "Saisissez votre adresse e-mail et votre mot de passe.";
    const res = await signIn.email({ email, password });
    if (res.error) {
      return res.error.message ?? "Identifiants incorrects.";
    }
    router.replace("/tableau-de-bord");
    router.refresh();
  });

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-2xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight text-strong">Connexion</h1>
      {expired ? (
        <p className="alert-warn mb-4 !rounded-lg !p-3 text-muted">
          Votre session a expiré, reconnectez-vous.
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
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
        <Field label="Mot de passe" htmlFor="password" required>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </Field>
        {error ? <p className="alert-error">{error}</p> : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/auth/forgot-password" className="underline hover:text-accent">
          Mot de passe oublié ?
        </Link>
      </p>
    </div>
  );
}
