import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indispensable pour l'image Docker minimale (cf. Dockerfile / DEPLOY.md)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Driver Postgres de Prisma 7 (pg : require dynamique) gardé hors bundle serveur.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  // Ce que le traçage standalone ne doit JAMAIS embarquer : les pièces jointes
  // déposées par les utilisateurs et les fichiers d'environnement. `ATTACHMENTS_DIR`
  // se replie sur path.join(process.cwd(), "attachments") — un chemin construit
  // depuis process.cwd() est indéchiffrable pour le traceur, qui embarquerait par
  // sécurité tout le projet dans .next/standalone (leçon culturesa-next).
  outputFileTracingExcludes: {
    "*": [
      "./attachments/**",
      // `.env` ET `.env*` : le glob `*` exige au moins un caractère, donc `./.env*`
      // seul laisserait passer le fichier `.env` lui-même.
      "./.env",
      "./.env*",
      "./*.tsbuildinfo",
      "./**/*.test.ts",
    ],
  },
  devIndicators: {
    position: "bottom-right",
  },
  // En-têtes de sécurité posés PAR L'APP (elle peut être servie en direct).
  async headers() {
    // La CSP n'est PAS ici : elle porte un nonce par réponse et se construit dans
    // le middleware (src/proxy.ts, lib/csp.ts). Un en-tête défini ici est figé au
    // build. NE PAS LA REMETTRE ICI « par sécurité » : le navigateur appliquerait
    // les DEUX politiques.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  experimental: {
    // Server Actions : autorise les origines du domaine de prod.
    serverActions: {
      // APP_DOMAIN peut lister plusieurs origines séparées par des virgules.
      allowedOrigins: process.env.APP_DOMAIN
        ? process.env.APP_DOMAIN.split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
    },
  },
};

export default nextConfig;
