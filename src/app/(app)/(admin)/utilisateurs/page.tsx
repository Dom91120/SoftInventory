import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";
import { UsersPanel } from "./users-panel";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UtilisateursPage() {
  const session = await requireRole("admin");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { nom: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      prenom: true,
      nom: true,
      role: true,
      ldap: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
    },
  });
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes locaux et comptes provisionnés depuis l'annuaire"
      />
      <UsersPanel
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          prenom: u.prenom,
          nom: u.nom,
          role: u.role,
          ldap: u.ldap,
          twoFactorEnabled: u.twoFactorEnabled,
          lastLoginAt: u.lastLoginAt ? fmt.format(u.lastLoginAt) : null,
          estMoi: u.id === session.user.id,
        }))}
      />
    </>
  );
}
