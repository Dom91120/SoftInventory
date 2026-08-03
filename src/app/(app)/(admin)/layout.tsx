import { requireRole } from "@/server/guards";

/**
 * Groupe des écrans d'ADMINISTRATION, imbriqué dans (app) : hérite du shell
 * connecté et ajoute l'exigence du rôle admin. Un lecteur qui force l'URL est
 * redirigé vers l'accueil par le garde.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return <>{children}</>;
}
