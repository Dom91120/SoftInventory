import type { Metadata } from "next";
import { Onglets, PageHeader } from "@/components/ui";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/guards";
import { DEFAULT_TEMPLATES, MAIL_KINDS } from "@/server/services/mail-templates";
import { lireConfigMessagerie } from "./actions";
import { EchecsPanel } from "./echecs-panel";
import { ModelesPanel } from "./modeles-panel";
import { ReglagesPanel } from "./reglages-panel";

export const metadata: Metadata = { title: "Messagerie" };

const ONGLETS = [
  { key: "reglages", label: "Réglages" },
  { key: "modeles", label: "Modèles d'e-mails" },
  { key: "echecs", label: "Envois en échec" },
] as const;
type OngletKey = (typeof ONGLETS)[number]["key"];

export default async function MessageriePage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  await requireRole("admin");
  const { onglet } = await searchParams;
  const actif: OngletKey = ONGLETS.some((o) => o.key === onglet)
    ? (onglet as OngletKey)
    : "reglages";

  const nbEchecs = await prisma.failedMail.count();

  return (
    <>
      <PageHeader
        title="Messagerie"
        subtitle="Serveur d'envoi, modèles d'e-mails et rappels d'échéances"
      />
      {/* Le compte d'échecs se porte SUR son onglet : il dit qu'il y a là
          quelque chose à traiter sans qu'on ait à y aller voir. */}
      <Onglets
        onglets={ONGLETS.map((o) => ({
          ...o,
          badge:
            o.key === "echecs" && nbEchecs > 0 ? (
              <span className="rounded-full bg-warn-dim px-1.5 text-xs font-semibold text-warn-text">
                {nbEchecs}
              </span>
            ) : undefined,
        }))}
        actif={actif}
        href={(key) => `/messagerie?onglet=${key}`}
      />

      {actif === "reglages" ? <ReglagesPanel config={await lireConfigMessagerie()} /> : null}
      {actif === "modeles" ? <OngletModeles /> : null}
      {actif === "echecs" ? <OngletEchecs /> : null}
    </>
  );
}

async function OngletModeles() {
  const rows = await prisma.mailTemplate.findMany({ orderBy: { position: "asc" } });
  const parCle = new Map(rows.map((r) => [r.key, r]));
  return (
    <ModelesPanel
      modeles={MAIL_KINDS.map((kind) => {
        const def = DEFAULT_TEMPLATES[kind];
        const row = parCle.get(kind);
        const surcharge = !!row && (row.subject.trim() !== "" || row.html.trim() !== "");
        return {
          key: kind,
          label: def.label,
          description: def.description,
          subject: row?.subject?.trim() ? row.subject : def.subject,
          html: row?.html?.trim() ? row.html : def.html,
          surcharge,
        };
      })}
    />
  );
}

async function OngletEchecs() {
  const echecs = await prisma.failedMail.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  return (
    <EchecsPanel
      echecs={echecs.map((m) => ({
        id: m.id,
        toAddr: m.toAddr,
        subject: m.subject,
        error: m.error,
        attempts: m.attempts,
        createdAt: fmt.format(m.createdAt),
        lastTriedAt: fmt.format(m.lastTriedAt),
      }))}
    />
  );
}
