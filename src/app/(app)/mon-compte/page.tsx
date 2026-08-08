import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/guards";
import { BoutonQuitter } from "./bouton-quitter";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mon compte" };

export default async function MonComptePage() {
  const session = await requireUser();
  const u = session.user as {
    email: string;
    prenom?: string;
    nom?: string;
    tel?: string;
    ldap?: boolean;
  };
  return (
    <>
      <PageHeader title="Mon compte" subtitle="Profil et sécurité de votre compte" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profil">
          <ProfileForm
            prenom={u.prenom ?? ""}
            nom={u.nom ?? ""}
            tel={u.tel ?? ""}
            email={u.email}
          />
        </Card>
        <Card title="Mot de passe">
          {u.ldap ? (
            <p className="text-sm text-muted">
              Votre compte est rattaché à l'annuaire de la collectivité : le mot de passe se change
              dans l'annuaire (Windows), pas ici.
            </p>
          ) : (
            <PasswordForm />
          )}
        </Card>
      </div>
      <div className="mt-4">
        <BoutonQuitter />
      </div>
    </>
  );
}
