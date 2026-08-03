import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/guards";
import { lireConfigAuthentification } from "./actions";
import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = { title: "Authentification" };

export default async function AuthentificationPage() {
  await requireRole("admin");
  const config = await lireConfigAuthentification();
  return (
    <>
      <PageHeader
        title="Authentification"
        subtitle="Connexion par l'annuaire de la collectivité et exigences de sécurité"
      />
      <AuthPanel config={config} />
    </>
  );
}
