import { Resend } from "resend";
import type { RenderedEmail } from "./index";

export interface SendOptions {
  /** Override the From header, e.g. `"Instituto X <no-reply@mail.institutox.org.br>"`. */
  from?: string;
  /** Reply-To address. */
  replyTo?: string;
  /** Extra headers — e.g. List-Unsubscribe for bulk mail. */
  headers?: Record<string, string>;
}

/**
 * Sends a rendered transactional/bulk e-mail. In development without RESEND_API_KEY
 * it just logs, so the local flow works without external services.
 */
export async function sendEmail(to: string, email: RenderedEmail, opts: SendOptions = {}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = opts.from ?? process.env.EMAIL_FROM ?? "Doações <no-reply@example.com>";

  if (!apiKey) {
    console.log(
      `\n[email:dev] from=${from} to=${to}${opts.replyTo ? ` reply-to=${opts.replyTo}` : ""}\n[email:dev] subject: ${email.subject}\n${email.text}\n`,
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.headers ? { headers: opts.headers } : {}),
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
