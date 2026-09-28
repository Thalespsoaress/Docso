const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'https://app.docso.app'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif"
const FONT_BODY = "'DM Sans', Helvetica, Arial, sans-serif"

// Layout único dos emails transacionais. Tabelas + estilos inline para
// renderizar igual em Gmail/Outlook. Todo texto recebido aqui já deve vir escapado.
export function emailLayout(opts: {
  titulo: string
  corpo: string // HTML
  cta: { label: string; href: string }
}): string {
  const { titulo, corpo, cta } = opts
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#FAFAFA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 0 24px 4px;">
          <img src="${FRONTEND_URL}/docso-logo-email.png" width="103" height="28" alt="docso" style="display:block;border:0;">
        </td></tr>
        <tr><td style="background:#FFFFFF;border:1px solid #E4E4E4;border-radius:12px;padding:36px 32px;">
          <h1 style="margin:0 0 16px;font-family:${FONT};font-weight:700;font-size:24px;line-height:1.25;letter-spacing:-0.5px;color:#0A0A0A;">${titulo}</h1>
          <div style="font-family:${FONT_BODY};font-size:15px;line-height:1.7;color:#444444;">${corpo}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>
            <td style="background:#0A0A0A;border-radius:8px;">
              <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-weight:600;font-size:14px;color:#FAFAFA;text-decoration:none;">${cta.label}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 4px 0;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:#A0A0A0;">
          Se não esperava este email, pode ignorá-lo.<br>Docso · Seu processo. No lugar certo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
