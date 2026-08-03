import { AppShell, type ShellUser } from "@/components/app-shell";
import { SessionWatchdog } from "@/components/session-watchdog";
import type { Role } from "@/generated/prisma/client";
import { requireUser, sessionDeadline } from "@/server/guards";

/**
 * Groupe des écrans connectés (lecteur ET admin). Les écrans d'administration
 * vivent dans le groupe (admin), dont le layout exige le rôle admin ; ici seul
 * un compte valide est requis — le lecteur consulte, les actions vérifient.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const u = session.user as {
    prenom?: string;
    nom?: string;
    email: string;
    role?: Role;
  };
  const user: ShellUser = {
    prenom: u.prenom ?? "",
    nom: u.nom ?? "",
    email: u.email,
    role: u.role === "admin" ? "admin" : "lecteur",
  };
  const deadline = await sessionDeadline();
  return (
    <AppShell user={user}>
      {deadline ? <SessionWatchdog expiresAt={deadline} /> : null}
      {children}
    </AppShell>
  );
}
