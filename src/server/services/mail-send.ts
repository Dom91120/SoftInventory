import { wrapEmailHtml } from "@/lib/email-theme";
import { renderHtmlTemplate, renderSubjectTemplate } from "@/lib/mail-render";
import { getAppUrl } from "@/server/config";
import { sendMail, sendMailOrQueue } from "@/server/mailer";
import { getMailTemplate, type MailKind } from "@/server/services/mail-templates";

/**
 * Envoi d'un e-mail à partir d'un gabarit (clé + variables), habillé du thème.
 *
 * `mode` :
 *  - "direct" : lève en cas d'échec — pour les envois où l'appelant doit savoir
 *    (test SMTP, lien de réinitialisation demandé à l'écran) ;
 *  - "queue"  : best-effort — l'échec est enregistré dans failed_mails pour
 *    renvoi ultérieur (rappels automatiques du cron).
 */
export async function sendTemplatedMail(opts: {
  to: string;
  kind: MailKind;
  vars: Record<string, string>;
  rawVars?: Record<string, string>;
  mode?: "direct" | "queue";
}): Promise<{ ok: boolean; queued: boolean; error?: string }> {
  const tpl = await getMailTemplate(opts.kind);
  const subject = renderSubjectTemplate(tpl.subject, opts.vars);
  const inner = renderHtmlTemplate(tpl.html, opts.vars, opts.rawVars ?? {});
  const appUrl = await getAppUrl();
  const html = wrapEmailHtml(inner, { preheader: subject, appUrl });

  if ((opts.mode ?? "queue") === "direct") {
    await sendMail({ to: opts.to, subject, html });
    return { ok: true, queued: false };
  }
  return sendMailOrQueue({ to: opts.to, subject, html });
}
