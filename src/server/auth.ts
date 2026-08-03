import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { emailButton } from "@/lib/email-theme";
import { greeting } from "@/lib/mail-render";
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from "@/lib/password";
import {
  ATTRIBUTS_COOKIE,
  alerteCookiesNonSecurises,
  cookiesSecurises,
} from "@/server/cookie-policy";
import { prisma } from "@/server/db";
import { authentifierLdap, ldapActif, provisionnerUtilisateurLdap } from "@/server/ldap";
import { clearLoginFailures, loginLockSeconds, recordLoginFailure } from "@/server/login-throttle";
import { sendTemplatedMail } from "@/server/services/mail-send";
import { SESSION_EXPIRES_IN, SESSION_FRESH_AGE, SESSION_UPDATE_AGE } from "@/server/session-policy";

// Endpoints Better Auth qui définissent/changent un mot de passe : on y impose la
// politique de complexité (Better Auth ne valide nativement que la longueur min).
const PASSWORD_ENDPOINTS = new Set(["/sign-up/email", "/reset-password", "/change-password"]);

/**
 * Alerte « votre mot de passe a été modifié ».
 *
 * Envoyée APRÈS coup, sur les DEUX chemins : réinitialisation par lien et
 * changement depuis le compte. Un attaquant qui prend un compte change le mot de
 * passe ; sans ce courriel, le titulaire légitime ne l'apprend qu'en découvrant
 * qu'il ne peut plus entrer.
 *
 * BEST-EFFORT : un relais SMTP indisponible ne doit pas faire échouer le
 * changement de mot de passe.
 */
async function notifierMotDePasseModifie(userId: string, email: string): Promise<void> {
  try {
    const prenom =
      (
        await prisma.user.findUnique({ where: { id: userId }, select: { prenom: true } })
      )?.prenom?.trim() ?? "";
    // Heure de Paris explicite : le conteneur tourne en UTC, et une heure fausse
    // dans une alerte de sécurité fait douter de l'alerte, pas de l'heure.
    const date = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date());
    await sendTemplatedMail({
      to: email,
      kind: "password_changed",
      vars: { salutation: greeting(prenom), prenom, date },
      mode: "direct",
    });
  } catch (e) {
    console.error("[auth] alerte de changement de mot de passe non envoyée:", e);
  }
}

/**
 * Alerte « votre double authentification a été modifiée ». Le second facteur est
 * ce qui protège un compte dont le mot de passe a fuité : sa modification, si
 * elle n'émane pas du titulaire, signale que quelqu'un est DÉJÀ entré.
 * BEST-EFFORT, comme pour le mot de passe.
 */
async function notifierSecondFacteurModifie(
  userId: string,
  email: string,
  operation: "activée" | "réinitialisée" | "désactivée",
): Promise<void> {
  try {
    const prenom =
      (
        await prisma.user.findUnique({ where: { id: userId }, select: { prenom: true } })
      )?.prenom?.trim() ?? "";
    const date = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date());
    await sendTemplatedMail({
      to: email,
      kind: "two_factor_changed",
      vars: { salutation: greeting(prenom), prenom, date, operation },
      mode: "direct",
    });
  } catch (e) {
    console.error("[auth] alerte de changement de second facteur non envoyée:", e);
  }
}

/**
 * Configuration Better Auth — application INTERNE :
 * - connexion e-mail/mot de passe (comptes créés par un administrateur) ;
 * - AUCUNE inscription publique : /sign-up/email est bloqué pour les requêtes
 *   HTTP, seuls les appels serveur internes (création par un admin) passent ;
 * - pas de captcha (réseau interne) ; freinage par compte + quota par IP conservés ;
 * - réinitialisation de mot de passe par e-mail ;
 * - 2FA TOTP disponible, exigence pilotée par app_config (two-factor-policy.ts).
 * L'authentification LDAP/AD (phase 8) provisionne les comptes puis crée la
 * session via l'API serveur — elle s'appuie sur cette même configuration.
 */
// Protection levée en production → on le dit, fort.
if (alerteCookiesNonSecurises()) {
  console.warn(
    "[auth] ⚠️ ALLOW_INSECURE_COOKIES=true : le cookie de session part SANS l'attribut " +
      "Secure. À réserver à un accès en HTTP sur réseau de confiance ; sur une " +
      "installation exposée, toute interception du réseau donne accès à la session.",
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Origines de confiance (anti-CSRF). Better Auth fait toujours confiance à
  // `baseURL` ; on AJOUTE ici :
  //   - en prod : la liste explicite de `TRUSTED_ORIGINS` (séparée par des virgules),
  //     ex. « http://softinventory.ville.local:3000 » pour un accès LAN ;
  //   - en dev : l'origine de la requête est reflétée (confort de test).
  trustedOrigins: (request?: Request) => {
    const list = (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === "development") {
      const origin = request?.headers.get("origin");
      if (origin && !list.includes(origin)) list.push(origin);
    }
    return list;
  },

  emailAndPassword: {
    enabled: true,
    // Pas de vérification d'adresse : les comptes sont créés par un admin avec
    // l'adresse professionnelle de l'agent — le lien « définir mon mot de passe »
    // envoyé à cette adresse joue déjà le rôle de preuve de possession.
    requireEmailVerification: false,
    // JAMAIS de session à l'inscription : le seul appelant de signUpEmail est
    // l'ADMIN qui crée un compte (appel interne) — avec l'auto-connexion par
    // défaut, nextCookies posait le cookie du compte créé et débarquait l'admin
    // de sa propre session (constaté en recette).
    autoSignIn: false,
    minPasswordLength: 12,

    // Reprendre la main sur son mot de passe doit reprendre la main sur son
    // COMPTE : sans cela, un attaquant déjà connecté garderait sa session.
    revokeSessionsOnPasswordReset: true,

    // Notification APRÈS coup : seul signal qui permette à un usager de
    // découvrir une prise de contrôle.
    onPasswordReset: async ({ user }) => {
      await notifierMotDePasseModifie(user.id, user.email);
    },

    sendResetPassword: async ({ user, url }) => {
      const prenom =
        (
          await prisma.user.findUnique({ where: { id: user.id }, select: { prenom: true } })
        )?.prenom?.trim() ?? "";
      await sendTemplatedMail({
        to: user.email,
        kind: "password_reset",
        vars: { salutation: greeting(prenom), prenom, url },
        rawVars: { bouton: emailButton(url, "Réinitialiser mon mot de passe") },
        mode: "direct",
      });
    },
  },

  // Durée de vie du COOKIE porteur et de la ligne `session`. Les délais réels
  // (inactivité / durée absolue par rôle) sont appliqués côté application —
  // cf. server/session-policy.ts, qui explique pourquoi le glissement natif de
  // Better Auth ne peut pas tenir ce rôle.
  session: {
    expiresIn: SESSION_EXPIRES_IN,
    updateAge: SESSION_UPDATE_AGE,
    freshAge: SESSION_FRESH_AGE,
  },

  // Attributs du cookie de session, FIGÉS plutôt que déduits du schéma de
  // `baseURL`. Règle, justification et échappatoire : server/cookie-policy.ts.
  advanced: {
    useSecureCookies: cookiesSecurises(),
    defaultCookieAttributes: ATTRIBUTS_COOKIE,
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // AUCUNE inscription publique : l'endpoint /sign-up/email n'est servi
      // qu'aux appels internes (auth.api.signUpEmail par un administrateur —
      // ils n'ont pas de `ctx.request`). Une requête HTTP directe est refusée.
      if (ctx.path === "/sign-up/email" && ctx.request) {
        throw new APIError("FORBIDDEN", {
          message: "Les comptes sont créés par un administrateur.",
        });
      }

      // Révocation des AUTRES sessions au changement de mot de passe.
      // Better Auth expose `revokeOtherSessions` dans le CORPS de la requête :
      // un paramètre de sécurité laissé à l'appelant n'est pas une garantie.
      // On le force ici, côté serveur.
      if (ctx.path === "/change-password" && ctx.body && typeof ctx.body === "object") {
        (ctx.body as { revokeOtherSessions?: boolean }).revokeOtherSessions = true;
      }

      // Freinage PAR COMPTE : le quota de Better Auth étant calé sur l'IP, il ne
      // voit pas le password spraying. Refus AVANT toute vérification de mot de
      // passe. Le freinage s'applique à l'identique que le compte existe ou non.
      if (ctx.path === "/sign-in/email" && ctx.request) {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === "string" && email) {
          const wait = await loginLockSeconds(email);
          if (wait > 0) {
            const minutes = Math.ceil(wait / 60);
            throw new APIError("TOO_MANY_REQUESTS", {
              message: `Trop de tentatives de connexion. Réessayez dans ${
                minutes <= 1 ? "une minute" : `${minutes} minutes`
              }.`,
            });
          }
        }
      }

      // Authentification ANNUAIRE (LDAP/AD), si activée : les identifiants sont
      // d'abord vérifiés contre l'annuaire ; en cas de succès le compte local
      // est provisionné/synchronisé (profil, rôle depuis les groupes, hash du
      // mot de passe AD), puis le flux STANDARD de Better Auth vérifie ce hash
      // et crée la session — un seul chemin de création de session.
      // Échec ou annuaire injoignable : on n'interrompt RIEN, la vérification
      // locale reprend la main (l'admin de secours entre toujours).
      if (ctx.path === "/sign-in/email" && ctx.request) {
        const body = ctx.body as { email?: unknown; password?: unknown } | undefined;
        const login = typeof body?.email === "string" ? body.email.trim() : "";
        const pwd = typeof body?.password === "string" ? body.password : "";
        if (login && pwd && (await ldapActif())) {
          const profil = await authentifierLdap(login, pwd);
          if (profil) {
            const ctxAuth = await auth.$context;
            await provisionnerUtilisateurLdap(profil, await ctxAuth.password.hash(pwd));
            // Le login saisi peut être un sAMAccountName : on normalise vers
            // l'adresse du compte pour la suite du flux.
            (ctx.body as { email?: string }).email = profil.email;
          }
        }
      }

      // Verrou sur /update-user : Better Auth expose cet endpoint authentifié qui
      // écrit dans la table `user` tout champ additionnel dépourvu de `input:false`.
      // L'app ne modifie le profil que via ses propres server actions : on
      // interdit ici la ré-écriture des champs sensibles (défense en profondeur,
      // `role` et `ldap` étant déjà couverts par input:false).
      if (ctx.path === "/update-user") {
        const b = (ctx.body ?? {}) as Record<string, unknown>;
        const locked = ["role", "ldap", "email", "emailVerified"];
        if (locked.some((k) => k in b)) {
          throw new APIError("BAD_REQUEST", { message: "Champ non modifiable." });
        }
      }

      // Enforcement serveur de la politique de mot de passe (complexité), en plus
      // du minPasswordLength : rejette une requête qui contournerait le formulaire.
      if (!PASSWORD_ENDPOINTS.has(ctx.path)) return;
      const body = (ctx.body ?? {}) as { password?: unknown; newPassword?: unknown };
      const pw = typeof body.password === "string" ? body.password : body.newPassword;
      if (typeof pw !== "string") return;
      if (!isPasswordValid(pw)) {
        throw new APIError("BAD_REQUEST", { message: PASSWORD_POLICY_MESSAGE });
      }
    }),

    // Comptage des échecs de connexion + alertes de sécurité. Les hooks `after`
    // sont bien exécutés quand l'endpoint échoue : l'erreur est capturée par le
    // dispatcher et déposée dans `ctx.context.returned`.
    after: createAuthMiddleware(async (ctx) => {
      // Changement de mot de passe depuis le compte : alerter le titulaire.
      // La réinitialisation par lien passe, elle, par `onPasswordReset`.
      if (ctx.path === "/change-password" && !(ctx.context.returned instanceof APIError)) {
        const u = (ctx.context.returned as { user?: { id?: string; email?: string } } | undefined)
          ?.user;
        if (u?.id && u.email) await notifierMotDePasseModifie(u.id, u.email);
        return;
      }

      // Modification du second facteur : alerter le titulaire.
      //
      // ⚠️ Sur `/two-factor/enable` et `/two-factor/disable` UNIQUEMENT, jamais
      // sur `/two-factor/verify-totp` : celui-ci est aussi appelé à CHAQUE
      // CONNEXION d'un compte protégé — une alerte qui arrive quand tout va bien
      // cesse d'être lue.
      //
      // `enable` ne bascule PAS `twoFactorEnabled` (c'est `verify-totp` qui le
      // fait) : la valeur lue ici est donc celle d'AVANT, ce qui distingue une
      // première activation d'un réenrôlement.
      if (
        (ctx.path === "/two-factor/enable" || ctx.path === "/two-factor/disable") &&
        !(ctx.context.returned instanceof APIError)
      ) {
        const u = ctx.context.session?.user as { id?: string; email?: string } | undefined;
        if (u?.id && u.email) {
          const avant = await prisma.user.findUnique({
            where: { id: u.id },
            select: { twoFactorEnabled: true },
          });
          await notifierSecondFacteurModifie(
            u.id,
            u.email,
            ctx.path === "/two-factor/disable"
              ? "désactivée"
              : avant?.twoFactorEnabled
                ? "réinitialisée"
                : "activée",
          );
        }
        return;
      }

      if (ctx.path !== "/sign-in/email" || !ctx.request) return;
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      if (typeof email !== "string" || !email) return;

      // Un APIError en retour = identifiants refusés. Tout le reste est un
      // succès : on efface alors le compteur, seuls les échecs CONSÉCUTIFS
      // devant peser.
      const returned = ctx.context.returned;
      if (returned instanceof APIError) await recordLoginFailure(email);
      else await clearLoginFailures(email);
    }),
  },

  // Met à jour `lastLoginAt` à chaque création de session (= chaque connexion,
  // tous flux confondus, connexion LDAP comprise).
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          try {
            await prisma.user.update({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
            });
          } catch (e) {
            console.error("[auth] maj lastLoginAt échouée:", e);
          }
        },
      },
    },
  },

  // Limitation du débit des requêtes d'auth. Quota PAR IP, persisté en base
  // (table rate_limits) : un redémarrage du conteneur ne remet pas les
  // compteurs à zéro. Il ne remplace pas le freinage par compte
  // (login-throttle.ts) : aucun des deux ne couvre le cas de l'autre.
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 10,
    customRules: {
      // Ce quota compte TOUTES les requêtes, succès compris — il ne peut donc
      // pas être aussi serré que le freinage par compte, qui ne compte que les
      // échecs. À 20/15 min, un service entier derrière un NAT reste servi.
      "/sign-in/email": { window: 15 * 60, max: 20 },
      // Chaque appel déclenche un envoi d'e-mail : bride le harcèlement d'une
      // boîte et la mise en liste noire du domaine de la collectivité.
      "/forget-password": { window: 15 * 60, max: 3 },
    },
  },

  // Champs métier additionnels persistés sur la table `user`.
  user: {
    additionalFields: {
      prenom: { type: "string", required: false, defaultValue: "" },
      nom: { type: "string", required: false, defaultValue: "" },
      tel: { type: "string", required: false, defaultValue: "" },
      role: { type: "string", required: false, defaultValue: "lecteur", input: false },
      ldap: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  plugins: [
    // Second facteur TOTP, disponible pour tous, exigé des admins seulement si
    // l'option est activée (Administration › Authentification). Le code n'est
    // demandé qu'après vérification du mot de passe : le second facteur s'ajoute
    // au premier, il ne le remplace pas.
    twoFactor({
      issuer: "SoftInventory",
      skipVerificationOnEnable: false,
    }),
    // Doit rester en dernier : branche la gestion des cookies sur Next.js.
    nextCookies(),
  ],
});
