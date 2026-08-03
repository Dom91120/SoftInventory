// Habillage HTML des e-mails — thème SoftInventory (indigo + neutres ardoise, même
// gamme que l'interface). Mise en page table + styles inline pour la compatibilité des
// clients mail, avec un <style> complémentaire pour les clients qui le supportent.
// Module pur (aucune dépendance serveur) : utilisable côté serveur (envoi) ET client
// (aperçu de l'éditeur). Le `innerHtml` est le corps du message (rendu des gabarits).

// Exporté : l'éditeur de modèles reproduit l'habillage en DOM pour l'édition
// « dans l'aperçu » — mêmes couleurs, source unique.
export const EMAIL_THEME = {
  pageBg: "#eef1f6",
  card: "#ffffff",
  border: "#e2e8f0",
  headerBg: "#f8fafc", // panneau d'en-tête + texte du pied
  green: "#4f46e5", // accent indigo (filet, titres, pied) — nom conservé pour l'API
  text: "#1e293b",
  muted: "#64748b",
};
const THEME = EMAIL_THEME;

/**
 * Échappement HTML des valeurs de confiance limitée injectées dans du HTML généré
 * (e-mails, impressions, PDF). SOURCE UNIQUE — échappe & < > " et ' → sûr en contenu
 * comme en attribut simple OU double quote. Utilisé par le moteur d'e-mails
 * (lib/mail-render), les listes imprimables (grilles agenda) et l'export PDF.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Assainit une URL destinée à un attribut `href` (constat S4).
 *
 * Le remplacement du seul guillemet (`href.replace(/"/g, "%22")`) empêchait de sortir
 * de l'attribut, mais laissait passer **le schéma** : `javascript:…` restait intact.
 * Or fermer l'échappement sans fermer le schéma protège contre la moitié du problème
 * en donnant le sentiment de l'avoir traité en entier.
 *
 * Liste BLANCHE de schémas, jamais noire : une liste noire oublie toujours quelque
 * chose (`data:`, `vbscript:`, `blob:`, les variantes encodées ou espacées). Les
 * chemins relatifs et les ancres restent admis — l'aperçu de l'éditeur de gabarits
 * passe `"#"`, et le refuser casserait un écran d'administration sans rien protéger.
 *
 * ── Pourquoi neutraliser plutôt que lever ──
 * Cette fonction sert dans le chemin d'ENVOI des e-mails de compte : réinitialisation
 * de mot de passe, confirmation d'adresse. Y lever une exception ferait échouer
 * l'envoi — donc priverait un usager de la récupération de son compte à cause d'une
 * URL mal configurée. Le lien est donc rendu inerte, et l'anomalie journalisée : le
 * message part, le bouton ne mène nulle part, et la trace dit pourquoi.
 */
const SCHEMAS_AUTORISES = ["http:", "https:", "mailto:"];

export function safeHref(href: string): string {
  const v = (href ?? "").trim();
  // Relatif, ancre ou requête : aucun schéma, donc aucun schéma dangereux.
  if (v === "" || v.startsWith("/") || v.startsWith("#") || v.startsWith("?")) return v || "#";
  try {
    // `new URL` normalise les ruses d'écriture (casse, espaces, retours à la ligne
    // insérés dans « java\nscript: ») qu'un test par expression régulière manquerait.
    if (SCHEMAS_AUTORISES.includes(new URL(v).protocol)) return v;
  } catch {
    // Non analysable → traité comme un schéma inconnu.
  }
  console.error(`[email-theme] URL au schéma non autorisé, lien neutralisé : ${v.slice(0, 80)}`);
  return "#";
}

/**
 * Bouton d'action (CTA) thématisé pour les e-mails — injecté en variable brute
 * `{{bouton}}`. `label` est ÉCHAPPÉ : aucun appelant ne fournit aujourd'hui de donnée
 * d'usager, mais la fonction est exportée depuis un module partagé et se présente
 * comme réutilisable — le prochain appelant héritait du piège (constat S4).
 */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(safeHref(href))}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a>`;
}

export function wrapEmailHtml(
  innerHtml: string,
  opts?: { preheader?: string; appUrl?: string },
): string {
  const t = THEME;
  // Pied de page : lien vers l'application si l'URL est configurée (Administration
  // › Configuration), sinon simple texte. Couleur forcée (le pied est sur fond vert foncé).
  // Même primitive que `emailButton` (constat S4) : ce lien portait le défaut
  // à l'identique, sans être cité par le constat. Sa source est pourtant plus
  // exposée — l'URL vient de la configuration éditable en administration, et
  // ce lien figure dans TOUS les e-mails, pas seulement ceux qui portent un bouton.
  //
  // `appUrlSchema` la valide déjà à la saisie ; on ne s'en remet pas à cette
  // validation-là. Une valeur peut entrer autrement (restauration d'un dump,
  // écriture directe en base), et une primitive de rendu qui suppose son entrée
  // déjà propre est exactement ce que ce constat reproche.
  const appUrl = opts?.appUrl?.trim();
  const portail = appUrl
    ? `<a href="${escapeHtml(safeHref(appUrl))}" style="color:#ffffff;text-decoration:underline;">SoftInventory</a>`
    : "SoftInventory";
  // Le préheader (= sujet rendu) peut contenir des variables non échappées (nom d'usager,
  // libellé de service) : on l'échappe avant injection dans le balisage de l'e-mail.
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<style>
  a { color: ${t.green}; }
  .em-body h1, .em-body h2, .em-body h3 { color: ${t.green}; margin: 0 0 12px; line-height: 1.25; }
  .em-body p { margin: 0 0 12px; }
  .em-body ul, .em-body ol { margin: 0 0 12px 20px; padding: 0; }
  .em-body li { margin: 4px 0; }
  .em-body blockquote { margin: 0 0 12px; padding-left: 12px; border-left: 3px solid ${t.green}; color: ${t.muted}; }
  .em-body table { border-collapse: collapse; }
  .em-body td, .em-body th { border: 1px solid ${t.border}; padding: 6px 10px; }
  .em-body img { max-width: 100%; height: auto; }
</style>
</head>
<body style="margin:0;padding:0;background:${t.pageBg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.pageBg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${t.card};border:1px solid ${t.border};border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
      <tr><td style="height:6px;background:${t.green};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="background:${t.headerBg};padding:18px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;font-size:20px;font-weight:bold;color:${t.green};font-family:Arial,Helvetica,sans-serif;">SoftInventory</td>
          <td align="right" style="font-size:12px;color:${t.muted};font-family:Arial,Helvetica,sans-serif;letter-spacing:.04em;vertical-align:middle;">Inventaire des logiciels</td>
        </tr></table>
      </td></tr>
      <tr><td class="em-body" style="padding:28px;font-size:15px;line-height:1.6;color:${t.text};font-family:Arial,Helvetica,sans-serif;">
${innerHtml}
      </td></tr>
      <tr><td style="background:${t.green};padding:16px 28px;color:#ffffff;font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
        ${portail}<br>
        Message automatique, merci de ne pas répondre à cet e-mail.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
