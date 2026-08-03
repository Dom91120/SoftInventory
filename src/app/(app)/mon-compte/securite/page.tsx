import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/guards";

export const metadata: Metadata = { title: "Sécurité" };

/**
 * Écran d'enrôlement du second facteur (cible de CHEMIN_ENROLEMENT).
 * L'enrôlement TOTP complet (QR code + vérification) arrive avec l'écran
 * Administration › Authentification ; l'option « exiger la 2FA des admins »
 * reste désactivée d'ici là.
 */
export default async function SecuritePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Sécurité" subtitle="Double authentification (TOTP)" />
      <Card title="Double authentification">
        <p className="text-sm text-muted">
          L'enrôlement de la double authentification sera disponible prochainement. Elle n'est pas
          exigée pour le moment.
        </p>
      </Card>
    </>
  );
}
