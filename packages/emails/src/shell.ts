import { BRAND, CANVAS, CARD_BORDER, FAINT_EMAIL, FONT_STACK_EMAIL, INK_EMAIL } from "@donation/tokens";

/**
 * The one e-mail chassis. Table-based so Outlook (Word engine) actually paints
 * the white card — it drops `background`/`border-radius`/`max-width` on `<div>`.
 * Used by every send path: `renderTemplate` (block templates) and the hardcoded
 * account/system e-mails in `index.ts`.
 */
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function emailShell(
  title: string,
  inner: string,
  opts: { footer?: string } = {},
): string {
  const footer = opts.footer ?? "Enviado pela plataforma de doações.";
  return `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<!--[if mso]><style>*{font-family:${FONT_STACK_EMAIL} !important}</style><![endif]-->
<style>a{color:${BRAND}}</style>
</head>
<body style="margin:0;padding:0;width:100%;background:${CANVAS}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}">
  <tr><td align="center" style="padding:32px 12px">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto">
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${CARD_BORDER};border-radius:14px;padding:36px 34px;font-family:${FONT_STACK_EMAIL};color:${INK_EMAIL};font-size:15px;line-height:1.6">${inner}</td></tr>
      <tr><td style="padding:18px 8px 0;text-align:center;font-family:${FONT_STACK_EMAIL};font-size:12px;line-height:1.5;color:${FAINT_EMAIL}">${footer}</td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body></html>`;
}
