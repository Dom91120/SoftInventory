"use client";

import {
  Building2,
  CalendarClock,
  ClipboardList,
  FileSignature,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Mail,
  Package,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode };

const ICON = "h-4 w-4";

const INVENTAIRE: Item[] = [
  {
    href: "/tableau-de-bord",
    label: "Tableau de bord",
    icon: <LayoutDashboard className={ICON} />,
  },
  { href: "/logiciels", label: "Logiciels", icon: <Package className={ICON} /> },
  { href: "/editeurs", label: "Éditeurs", icon: <Building2 className={ICON} /> },
  { href: "/contrats", label: "Contrats/Marchés", icon: <FileSignature className={ICON} /> },
  { href: "/serveurs", label: "Serveurs", icon: <Server className={ICON} /> },
  // Après les serveurs et avant les tâches : les certificats sont un parc de
  // plus à tenir, et comme les tâches, ils ont une échéance qui court.
  { href: "/certificats", label: "Certificats", icon: <ShieldCheck className={ICON} /> },
  { href: "/taches", label: "Tâches", icon: <ClipboardList className={ICON} /> },
];

const ADMINISTRATION: Item[] = [
  { href: "/utilisateurs", label: "Utilisateurs", icon: <Users className={ICON} /> },
  { href: "/referentiels", label: "Référentiels", icon: <ListChecks className={ICON} /> },
  { href: "/messagerie", label: "Messagerie", icon: <Mail className={ICON} /> },
  { href: "/authentification", label: "Authentification", icon: <KeyRound className={ICON} /> },
  {
    href: "/taches-planifiees",
    label: "Tâches planifiées",
    icon: <CalendarClock className={ICON} />,
  },
  { href: "/journal", label: "Journal", icon: <ScrollText className={ICON} /> },
];

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: Item[];
  pathname: string;
}) {
  return (
    <>
      <div className="mb-0.5 mt-2 px-3 text-[0.64rem] font-bold uppercase leading-4 tracking-[0.13em] text-faint">
        {title}
      </div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-1 text-sm font-medium transition ${
              active ? "bg-accent-dim text-accent" : "text-muted hover:bg-inset hover:text-strong"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** Liens de la sidebar, avec état actif ; la section Administration n'apparaît qu'aux admins. */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      <NavSection title="Inventaire" items={INVENTAIRE} pathname={pathname} />
      {isAdmin ? (
        <NavSection title="Administration" items={ADMINISTRATION} pathname={pathname} />
      ) : null}
    </nav>
  );
}
