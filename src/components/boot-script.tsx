"use client";

import { useSyncExternalStore } from "react";

// Script anti-FOUC du layout racine : applique le thème sombre AVANT le premier
// paint (lecture localStorage, repli sur la préférence système). Convention
// simcity : attribut `data-theme="dark"` sur <html>, clair par défaut.
const BOOT_CODE =
  "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark';}catch(e){}";

const noopSubscribe = () => () => {};

/**
 * Rend le script anti-FOUC UNIQUEMENT côté serveur : il sort dans le HTML initial
 * (inline, bloquant → exécuté par le parseur avant le premier paint), puis React le
 * RETIRE au premier rendu client — sans avertissement de mismatch, grâce au double
 * instantané serveur/client de useSyncExternalStore (pattern documenté React).
 *
 * Pourquoi : un <script> inline rendu côté client déclenche l'avertissement React 19
 * « Encountered a script tag while rendering React component » à chaque re-rendu de
 * l'arbre (récupération d'erreur en dev, notamment pendant les pannes de base ou les
 * rechargements massifs). En ne rendant JAMAIS le script côté client (y compris après
 * un remontage par error boundary), l'avertissement devient impossible. Le retrait du
 * nœud après hydratation est sans effet : le script a déjà été exécuté au parsing, et
 * les classes qu'il pose vivent sur <html>.
 *
 * `nonce` : imposé par la CSP depuis le constat S2. Ce composant étant CLIENT, il
 * ne peut pas lire `headers()` lui-même — le layout racine le lui transmet. Sans
 * nonce, le navigateur refuse d'exécuter ce script et le thème sombre réapparaît
 * en clair le temps de l'hydratation : la panne serait visuelle, pas bloquante,
 * donc facile à ne pas voir passer.
 */
export function BootScript({ nonce }: { nonce?: string }) {
  const isServer = useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
  if (!isServer) return null;
  return (
    <script
      nonce={nonce}
      // Les navigateurs EFFACENT l'attribut `nonce` du DOM après l'analyse, par
      // conception : sans cela, un sélecteur CSS suffirait à le lire et à le
      // rejouer, ce qui viderait la CSP par nonce de son sens. La PROPRIÉTÉ
      // `script.nonce` reste, elle, renseignée — c'est elle que le navigateur
      // utilise. React compare donc « nonce=… » (rendu serveur) à « nonce="" »
      // (attribut relu) et signale une divergence d'hydratation.
      //
      // ⚠️ `suppressHydrationWarning` NE LA FAIT PAS TAIRE ICI — vérifié : React
      // hisse les éléments de `<head>`, ce qui paraît court-circuiter l'option.
      // L'attribut est conservé pour exprimer l'intention et parce qu'il ne coûte
      // rien, PAS parce qu'il résout le problème.
      //
      // Portée réelle : l'avertissement n'existe qu'en DÉVELOPPEMENT ; la console
      // d'un build de production est vide (vérifié). La divergence est de toute
      // façon inoffensive — le script a déjà été exécuté au parsing, et ce
      // composant ne rend rien côté client.
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique, sans donnée externe.
      dangerouslySetInnerHTML={{ __html: BOOT_CODE }}
    />
  );
}
