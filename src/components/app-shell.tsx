import { Boxes, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export type ShellUser = {
  prenom: string;
  nom: string;
  email: string;
  role: "lecteur" | "admin";
};

function displayName(u: ShellUser): string {
  const full = `${u.prenom} ${u.nom}`.trim();
  return full || u.email;
}

function initials(u: ShellUser): string {
  const a = u.prenom.trim().charAt(0) || u.email.charAt(0);
  const b = u.nom.trim().charAt(0);
  return (a + b).toUpperCase();
}

function Brand() {
  return (
    <Link
      href="/tableau-de-bord"
      className="flex h-14 items-center gap-2.5 border-b border-line px-5"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Boxes className="h-5 w-5" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-accent">SoftInventory</span>
    </Link>
  );
}

function UserFooter({ user }: { user: ShellUser }) {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <span
          className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))",
          }}
        >
          {initials(user)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-strong">
            {displayName(user)}
          </span>
          <span className="block text-[0.64rem] font-bold uppercase tracking-[0.13em] text-faint">
            {user.role === "admin" ? "Administrateur" : "Lecteur"}
          </span>
        </span>
        <ThemeToggle />
        <LogoutButton />
      </div>
      <Link
        href="/mon-compte"
        className="block rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-strong"
      >
        Mon compte
      </Link>
    </div>
  );
}

/**
 * Enveloppe des écrans connectés — « style cparfait » : sidebar fixe (marque,
 * sections en micro-capitales, bloc utilisateur en pied) + contenu centré.
 * Mobile : la sidebar devient un <details> natif sous un bandeau, sans JS.
 */
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const isAdmin = user.role === "admin";
  return (
    <div className="flex min-h-screen">
      {/* Sidebar bureau */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <Brand />
        <SidebarNav isAdmin={isAdmin} />
        <UserFooter user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navigation mobile : <details> natif, aucun JS */}
        <details className="group border-b border-line bg-surface md:hidden">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Boxes className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-accent">
                SoftInventory
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-muted">
              Menu
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-line pb-2">
            <SidebarNav isAdmin={isAdmin} />
            <UserFooter user={user} />
          </div>
        </details>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
