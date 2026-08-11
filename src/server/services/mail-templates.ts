import { prisma } from "@/server/db";

// ════════════════════════════════════════════════════════════════════════════
//  Gabarits d'e-mails. La CLÉ fait contrat avec le code : chaque gabarit
//  correspond à un point d'envoi précis. Le contenu (sujet + HTML) est éditable
//  en Administration › Messagerie (table mail_templates) ; les valeurs du code
//  ci-dessous servent de DÉFAUT et de repli de sûreté quand la ligne en base
//  est absente ou vide.
//
//  Variables : interpolation {{var}} (échappée) et {{#if var}}…{{/if}}
//  (cf. lib/mail-render.ts). `{{bouton}}` est une variable BRUTE (HTML de
//  confiance générée par l'app).
// ════════════════════════════════════════════════════════════════════════════

export type MailKind =
  | "password_reset"
  | "password_changed"
  | "two_factor_changed"
  | "compte_cree"
  | "tache_rappel"
  | "tache_retard"
  | "contrat_rappel"
  | "certificat_rappel";

export type MailTemplateDef = {
  label: string;
  description: string;
  subject: string;
  html: string;
  position: number;
};

export const DEFAULT_TEMPLATES: Record<MailKind, MailTemplateDef> = {
  password_reset: {
    label: "Réinitialisation de mot de passe",
    description:
      "Envoyé quand un utilisateur (ou un admin pour lui) demande un lien de réinitialisation.",
    subject: "SoftInventory — réinitialisation de votre mot de passe",
    position: 1,
    html: `<p>{{salutation}}</p>
<p>Une réinitialisation du mot de passe de votre compte SoftInventory a été demandée.
Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.</p>
<p>{{bouton}}</p>
<p>Ce lien expire rapidement ; passé ce délai, refaites une demande.</p>`,
  },
  password_changed: {
    label: "Alerte : mot de passe modifié",
    description: "Alerte de sécurité envoyée au titulaire après un changement de mot de passe.",
    subject: "SoftInventory — votre mot de passe a été modifié",
    position: 2,
    html: `<p>{{salutation}}</p>
<p>Le mot de passe de votre compte SoftInventory a été modifié le {{date}}.</p>
<p>Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement un
administrateur : quelqu'un d'autre a peut-être accès à votre compte.</p>`,
  },
  two_factor_changed: {
    label: "Alerte : double authentification modifiée",
    description:
      "Alerte de sécurité envoyée quand la 2FA d'un compte est activée, réinitialisée ou désactivée.",
    subject: "SoftInventory — votre double authentification a été {{operation}}",
    position: 3,
    html: `<p>{{salutation}}</p>
<p>La double authentification de votre compte SoftInventory a été {{operation}} le {{date}}.</p>
<p>Si vous n'êtes pas à l'origine de cette opération, contactez immédiatement un
administrateur.</p>`,
  },
  compte_cree: {
    label: "Compte créé",
    description:
      "Envoyé à un nouvel utilisateur créé par un administrateur, avec le lien pour définir son mot de passe.",
    subject: "SoftInventory — votre compte a été créé",
    position: 4,
    html: `<p>{{salutation}}</p>
<p>Un compte vient de vous être créé sur SoftInventory, l'inventaire des logiciels
de la collectivité.</p>
<p>Définissez votre mot de passe pour vous connecter :</p>
<p>{{bouton}}</p>`,
  },
  tache_rappel: {
    label: "Rappel de tâche à échéance",
    description:
      "Rappel envoyé avant l'échéance d'une tâche récurrente (mise à jour, purge, certificat…).",
    subject: "SoftInventory — {{titre}} ({{logiciel}}) à faire pour le {{echeance}}",
    position: 5,
    html: `<p>{{salutation}}</p>
<p>La tâche <strong>{{titre}}</strong> sur le logiciel <strong>{{logiciel}}</strong>
arrive à échéance le <strong>{{echeance}}</strong>.</p>
{{#if description}}<p>{{description}}</p>{{/if}}
{{#if assigne}}<p>Personne en charge : {{assigne}}</p>{{/if}}
{{#if url}}<p>{{bouton}}</p>{{/if}}`,
  },
  tache_retard: {
    label: "Tâche en retard",
    description: "Rappel envoyé quand l'échéance d'une tâche récurrente est dépassée.",
    subject: "SoftInventory — EN RETARD : {{titre}} ({{logiciel}}), échéance {{echeance}}",
    position: 6,
    html: `<p>{{salutation}}</p>
<p>La tâche <strong>{{titre}}</strong> sur le logiciel <strong>{{logiciel}}</strong>
devait être faite pour le <strong>{{echeance}}</strong> et n'est pas marquée comme réalisée.</p>
{{#if description}}<p>{{description}}</p>{{/if}}
{{#if assigne}}<p>Personne en charge : {{assigne}}</p>{{/if}}
{{#if url}}<p>{{bouton}}</p>{{/if}}`,
  },
  contrat_rappel: {
    label: "Renouvellement de contrat",
    description:
      "Rappel envoyé avant une date de renouvellement de contrat ou une fin de contrat/marché.",
    subject: "SoftInventory — {{objet}} ({{logiciel}}) à renouveler pour le {{echeance}}",
    position: 7,
    html: `<p>{{salutation}}</p>
<p>{{objet}} du logiciel <strong>{{logiciel}}</strong> arrive à échéance le
<strong>{{echeance}}</strong>.</p>
{{#if details}}<p>{{details}}</p>{{/if}}
{{#if url}}<p>{{bouton}}</p>{{/if}}`,
  },
  certificat_rappel: {
    label: "Expiration de certificat",
    description:
      "Rappel envoyé avant la fin de validité d'un certificat électronique (élu, agent ou serveur).",
    subject: "SoftInventory — le certificat de {{titulaire}} expire le {{echeance}}",
    position: 8,
    // Le titulaire ET sa fonction : un certificat de Maire ne se renouvelle pas
    // avec la même urgence que celui d'un agent, et c'est la fonction qui le
    // dit. Le délai de commande est rappelé en clair — c'est la raison d'être
    // de l'alerte, un certificat ne se renouvelle pas le jour où il expire.
    html: `<p>{{salutation}}</p>
<p>Le certificat électronique de <strong>{{titulaire}}</strong>{{#if fonction}} ({{fonction}}){{/if}}
arrive à expiration le <strong>{{echeance}}</strong>.</p>
{{#if details}}<p>{{details}}</p>{{/if}}
<p>Passé cette date, les signatures et télétransmissions qui s'appuient dessus ne
fonctionneront plus : la commande du renouvellement demande d'être engagée en amont.</p>
{{#if url}}<p>{{bouton}}</p>{{/if}}`,
  },
};

export const MAIL_KINDS = Object.keys(DEFAULT_TEMPLATES) as MailKind[];

/**
 * Contenu effectif d'un gabarit : ligne en base si son sujet/HTML est non vide,
 * sinon défaut du code. Le repli est PAR CHAMP : un admin peut ne surcharger que
 * le sujet.
 */
export async function getMailTemplate(kind: MailKind): Promise<{ subject: string; html: string }> {
  const def = DEFAULT_TEMPLATES[kind];
  const row = await prisma.mailTemplate.findUnique({ where: { key: kind } });
  return {
    subject: row?.subject?.trim() ? row.subject : def.subject,
    html: row?.html?.trim() ? row.html : def.html,
  };
}
