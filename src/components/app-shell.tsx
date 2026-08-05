import { Boxes, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

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
      className="flex h-12 items-center gap-2.5 border-b border-line px-5"
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
    <div className="relative border-t border-line p-2">
      <UserMenu
        initiales={initials(user)}
        nomAffiche={displayName(user)}
        role={user.role === "admin" ? "Administrateur" : "Lecteur"}
      />
      {/* Hors du <details> : dans le <summary>, un clic sur l'un de ces boutons
          replierait le menu par-dessus le marché. D'où le positionnement en
          absolu — le seul moyen de les poser SUR le bloc d'identité sans être
          dedans.

          `top-1 right-1` : 4 px du trait, sur la ligne du nom. Ils ne rentrent
          PAS dans la boîte de survol et n'ont pas à le faire.

          Le fond opaque qui bloque la couleur de survol est porté par CHAQUE
          bouton (voir ThemeToggle et LogoutButton), non par ce conteneur : posé
          ici, il masquait aussi l'espace qui les sépare, où la couleur doit se
          voir. */}
      <span className="absolute top-1 right-1 z-30 flex items-center gap-1">
        <ThemeToggle />
        <LogoutButton />
      </span>
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 lg:px-8 lg:py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
