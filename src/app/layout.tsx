import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import { BootScript } from "@/components/boot-script";
import "./globals.css";

// Polices auto-hébergées par next/font (aucune requête visiteur vers Google —
// exigence RGPD). IBM Plex = la typo du « style cparfait » (cf. simcity).
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "SoftInventory",
    template: "%s — SoftInventory",
  },
  description: "Inventaire des logiciels de la collectivité",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce CSP posé par le middleware (src/proxy.ts) : transmis au script inline
  // anti-FOUC, sans quoi le navigateur refuserait de l'exécuter.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning : le boot-script pose data-theme sur <html> avant
    // l'hydratation — divergence attendue et inoffensive.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        <BootScript nonce={nonce} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
