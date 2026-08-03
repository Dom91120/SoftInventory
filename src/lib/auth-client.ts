"use client";

import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth pour les composants React (login, mon-compte, etc.).
 * Les `additionalFields` sont redéclarés ici (en miroir de src/server/auth.ts)
 * afin que TypeScript les accepte — sans importer de code serveur.
 */
export const authClient = createAuthClient({
  // Dans le navigateur, on cible TOUJOURS l'origine réelle d'où la page a été
  // servie (localhost en local, ou l'IP/nom LAN depuis un autre poste) : une
  // baseURL figée ferait partir le fetch vers le localhost du client.
  // Repli sur l'env côté serveur (SSR).
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        prenom: { type: "string", required: false },
        nom: { type: "string", required: false },
        tel: { type: "string", required: false },
        twoFactorEnabled: { type: "boolean", required: false },
      },
    }),
    // Second facteur. Sans `twoFactorPage` ni `onTwoFactorRedirect` : la
    // connexion renvoie alors `twoFactorRedirect: true` dans sa réponse, et le
    // formulaire enchaîne sur la saisie du code SANS changer de page.
    twoFactorClient(),
  ],
});

export const { signIn, signOut, useSession, twoFactor } = authClient;
