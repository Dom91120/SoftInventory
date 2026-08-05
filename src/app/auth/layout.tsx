import { Boxes } from "lucide-react";

/**
 * Écrans publics d'authentification — style « login simcity » : plein écran en
 * dégradé sombre, carte claire centrée, logo + wordmark au-dessus du formulaire.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-3 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Boxes className="h-7 w-7" />
          </span>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-white">SoftInventory</div>
            <div className="text-sm text-white/60">Inventaire des logiciels de la collectivité</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
