import { Client } from "ldapts";
import { getConfigMany } from "@/server/config";
import { journal } from "@/server/log";
import { decryptSecret } from "@/server/secret-crypto";

// ════════════════════════════════════════════════════════════════════════════
//  Authentification annuaire (LDAP / Active Directory) — PARAMÉTRABLE depuis
//  Administration › Authentification, désactivée par défaut.
//
//  Flux (branché dans server/auth.ts, hook /sign-in/email) :
//   1. bind de service (ou anonyme) → recherche de l'utilisateur par login ;
//   2. bind avec le DN trouvé + mot de passe saisi = vérification annuaire ;
//   3. rôle déduit des groupes AD (memberOf) via le mapping configuré ;
//   4. provisionnement/synchronisation du compte local, puis le flux normal
//      de Better Auth crée la session.
//
//  L'annuaire INDISPONIBLE n'est jamais bloquant : on retombe sur les comptes
//  locaux (l'admin de secours doit toujours pouvoir entrer).
// ════════════════════════════════════════════════════════════════════════════

export type ConfigLdap = {
  actif: boolean;
  url: string; // ldap://dc.ville.local:389 ou ldaps://…:636
  baseDn: string; // ex. DC=ville,DC=local
  bindDn: string; // compte de service (vide = bind anonyme)
  bindPassword: string;
  /** Filtre de recherche, {login} remplacé par la saisie (échappée). */
  filtreUtilisateur: string;
  /** DN (ou fragment) du groupe donnant le rôle admin. */
  groupeAdmin: string;
  /** DN (ou fragment) du groupe donnant l'accès lecteur ; vide = tout utilisateur trouvé. */
  groupeLecteur: string;
};

export const FILTRE_PAR_DEFAUT =
  "(|(sAMAccountName={login})(userPrincipalName={login})(mail={login}))";

export async function lireConfigLdap(): Promise<ConfigLdap> {
  const cfg = await getConfigMany([
    "ldap.actif",
    "ldap.url",
    "ldap.baseDn",
    "ldap.bindDn",
    "ldap.bindPassword",
    "ldap.filtreUtilisateur",
    "ldap.groupeAdmin",
    "ldap.groupeLecteur",
  ]);
  return {
    actif: cfg["ldap.actif"] === "true",
    url: cfg["ldap.url"].trim(),
    baseDn: cfg["ldap.baseDn"].trim(),
    bindDn: cfg["ldap.bindDn"].trim(),
    bindPassword: decryptSecret(cfg["ldap.bindPassword"]),
    filtreUtilisateur: cfg["ldap.filtreUtilisateur"].trim() || FILTRE_PAR_DEFAUT,
    groupeAdmin: cfg["ldap.groupeAdmin"].trim(),
    groupeLecteur: cfg["ldap.groupeLecteur"].trim(),
  };
}

export async function ldapActif(): Promise<boolean> {
  const c = await lireConfigLdap();
  return c.actif && c.url !== "" && c.baseDn !== "";
}

/** Échappement RFC 4515 d'une valeur injectée dans un filtre LDAP. */
export function echapperFiltre(valeur: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: NUL fait partie des caractères à échapper (RFC 4515).
  return valeur.replace(/[\\*()\u0000]/g, (c) => {
    switch (c) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
}

export type ProfilLdap = {
  dn: string;
  email: string;
  prenom: string;
  nom: string;
  role: "lecteur" | "admin";
};

const asString = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (v instanceof Buffer) return v.toString("utf8");
  return "";
};

const asStrings = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => (x instanceof Buffer ? x.toString("utf8") : String(x)));
  if (v === undefined || v === null) return [];
  return [asString(v)];
};

/** Appartenance à un groupe : comparaison sur le DN complet OU un fragment (CN=…). */
function membreDe(memberOf: string[], groupe: string): boolean {
  if (!groupe) return false;
  const cible = groupe.toLowerCase();
  return memberOf.some((g) => {
    const dn = g.toLowerCase();
    return dn === cible || dn.includes(cible);
  });
}

/**
 * Vérifie un couple login/mot de passe contre l'annuaire. Renvoie le profil
 * (rôle déduit des groupes) ou null : mauvais identifiants, utilisateur hors
 * des groupes autorisés, annuaire injoignable — dans tous les cas le flux
 * local reprend la main, et la raison est journalisée côté serveur.
 */
export async function authentifierLdap(
  login: string,
  motDePasse: string,
): Promise<ProfilLdap | null> {
  if (motDePasse === "") return null; // un bind AD à mot de passe vide « réussit » (anonyme)
  const c = await lireConfigLdap();
  if (!c.actif || !c.url || !c.baseDn) return null;

  const client = new Client({ url: c.url, timeout: 5000, connectTimeout: 5000 });
  try {
    // 1. Bind de service (ou anonyme) pour retrouver le DN.
    if (c.bindDn) await client.bind(c.bindDn, c.bindPassword);

    const filtre = c.filtreUtilisateur.replaceAll("{login}", echapperFiltre(login.trim()));
    const { searchEntries } = await client.search(c.baseDn, {
      scope: "sub",
      filter: filtre,
      sizeLimit: 2,
      attributes: ["dn", "mail", "userPrincipalName", "givenName", "sn", "memberOf"],
    });
    if (searchEntries.length !== 1) {
      journal.avert("ldap", "utilisateur introuvable ou ambigu dans l'annuaire", {
        resultats: searchEntries.length,
      });
      return null;
    }
    const entry = searchEntries[0];
    const dn = asString(entry.dn);

    // 2. Le bind de l'utilisateur EST la vérification du mot de passe.
    await client.unbind().catch(() => {});
    const clientUser = new Client({ url: c.url, timeout: 5000, connectTimeout: 5000 });
    try {
      await clientUser.bind(dn, motDePasse);
    } catch {
      journal.avert("ldap", "mot de passe annuaire refusé", {});
      return null;
    } finally {
      await clientUser.unbind().catch(() => {});
    }

    // 3. Rôle depuis les groupes.
    const memberOf = asStrings(entry.memberOf);
    const role: ProfilLdap["role"] | null = membreDe(memberOf, c.groupeAdmin)
      ? "admin"
      : c.groupeLecteur === "" || membreDe(memberOf, c.groupeLecteur)
        ? "lecteur"
        : null;
    if (role === null) {
      journal.avert("ldap", "utilisateur authentifié mais hors des groupes autorisés", {});
      return null;
    }

    const email = (asString(entry.mail) || asString(entry.userPrincipalName) || login)
      .trim()
      .toLowerCase();
    if (!email.includes("@")) {
      journal.avert("ldap", "aucune adresse e-mail exploitable dans l'annuaire", {});
      return null;
    }
    return { dn, email, prenom: asString(entry.givenName), nom: asString(entry.sn), role };
  } catch (e) {
    // Annuaire injoignable, certificat, base DN faux… : on N'EMPÊCHE PAS la
    // connexion locale — l'admin de secours doit toujours pouvoir entrer.
    journal.avert("ldap", "annuaire indisponible ou configuration invalide", {
      detail: e instanceof Error ? e.message : String(e),
    });
    return null;
  } finally {
    await client.unbind().catch(() => {});
  }
}

/**
 * Provisionne/synchronise le compte local d'un utilisateur vérifié par
 * l'annuaire : profil et RÔLE recalés à chaque connexion (le mapping des
 * groupes AD fait foi), et hash local du mot de passe AD recalé — c'est lui
 * que le flux standard de Better Auth vérifie ensuite pour créer la session.
 * `passwordHash` est produit par l'appelant (contexte Better Auth) pour éviter
 * une dépendance circulaire avec server/auth.ts.
 */
export async function provisionnerUtilisateurLdap(
  profil: ProfilLdap,
  passwordHash: string,
): Promise<void> {
  const { prisma } = await import("@/server/db");
  const nomComplet = `${profil.prenom} ${profil.nom}`.trim() || profil.email;
  const user = await prisma.user.upsert({
    where: { email: profil.email },
    update: {
      prenom: profil.prenom,
      nom: profil.nom,
      name: nomComplet,
      role: profil.role,
      ldap: true,
      emailVerified: true,
    },
    create: {
      email: profil.email,
      prenom: profil.prenom,
      nom: profil.nom,
      name: nomComplet,
      role: profil.role,
      ldap: true,
      emailVerified: true,
    },
  });
  const cred = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });
  if (cred) {
    await prisma.account.update({ where: { id: cred.id }, data: { password: passwordHash } });
  } else {
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }
}

/** Test de connexion pour l'écran d'administration : bind + recherche de la base. */
export async function testerConnexionLdap(): Promise<{ ok: boolean; detail: string }> {
  const c = await lireConfigLdap();
  if (!c.url || !c.baseDn) {
    return { ok: false, detail: "Renseignez au moins l'URL du serveur et la base DN." };
  }
  const client = new Client({ url: c.url, timeout: 5000, connectTimeout: 5000 });
  try {
    if (c.bindDn) await client.bind(c.bindDn, c.bindPassword);
    const { searchEntries } = await client.search(c.baseDn, {
      scope: "base",
      filter: "(objectClass=*)",
      sizeLimit: 1,
      attributes: ["dn"],
    });
    return {
      ok: true,
      detail: `Connexion réussie (${c.bindDn ? "bind de service" : "bind anonyme"}, base ${searchEntries.length ? "trouvée" : "vide"}).`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur inconnue." };
  } finally {
    await client.unbind().catch(() => {});
  }
}
