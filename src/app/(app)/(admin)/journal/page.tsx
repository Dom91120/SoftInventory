import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";

export const metadata: Metadata = { title: "Journal" };

/** Libellés lisibles des actions journalisées (clés stables, cf. server/audit.ts). */
const LIBELLES_ACTIONS: Record<string, string> = {
  "user.created": "Compte créé",
  "user.updated": "Compte modifié",
  "user.deleted": "Compte supprimé",
  "user.role_changed": "Rôle modifié",
  "user.password_reset_sent": "Lien de réinitialisation envoyé",
  "user.two_factor_reset": "2FA réinitialisée",
  "config.mail_changed": "Réglages SMTP modifiés",
  "config.ldap_changed": "Réglages LDAP modifiés",
  "config.security_changed": "Réglages de sécurité modifiés",
  "document.uploaded": "Document déposé",
  "document.deleted": "Document supprimé",
  "logiciel.deleted": "Logiciel supprimé",
  "editeur.deleted": "Éditeur supprimé",
};

export default async function JournalPage() {
  await requireRole("admin");
  const entrees = await prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 200 });
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Paris",
  });
  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Actions d'administration des 200 derniers événements (conservées 2 ans)"
      />
      <Card title="Événements">
        {entrees.length === 0 ? (
          <EmptyState>Aucun événement enregistré pour l'instant.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Par</th>
                  <th>Cible</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs text-muted">{fmt.format(e.at)}</td>
                    <td>
                      <span className="font-medium text-strong">
                        {LIBELLES_ACTIONS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="text-xs">
                      {e.actorLabel}
                      {e.actorRole ? <span className="block text-faint">{e.actorRole}</span> : null}
                    </td>
                    <td className="text-xs text-muted">{e.target ?? "—"}</td>
                    <td className="text-xs text-faint">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
